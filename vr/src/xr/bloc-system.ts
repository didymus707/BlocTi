import {
  createSystem,
  PanelDocument,
  PanelUI,
  VisibilityState,
  type Entity,
  type UIKitDocument,
} from '@iwsdk/core';
import { PANEL_URLS } from '../assets';
import type { CardControl, Control } from '../bloc/controls';
import { DEV_USER_ID, orderedTaskStates, type Verdict } from '../bloc/engine';
import {
  addEntry,
  entryFromRun,
  loadHistory,
  recentVerdicts,
  saveHistory,
  trendLine,
  type HistoryEntry,
} from '../bloc/history';
import { BOARD_SLOT, FOCUS_SLOT, MAX_CARDS, cardSlots, type Slot } from '../bloc/layout';
import {
  applyControl,
  clearRun,
  isFinished,
  loadRun,
  newRun,
  saveRun,
  viewRun,
  type Run,
  type RunView,
} from '../bloc/run';
import { browserStore, type KeyValueStore } from '../bloc/storage';
import { TEMPLATES, type Template } from '../bloc/templates';
import {
  cardViews,
  focusView,
  reportView,
  templateLine,
  type CardTone,
  type CardView,
} from '../bloc/view';
import { BlocLayout, BlocPanel, PANEL_ROLES, type PanelRole } from './components';
import { PANEL_SCALE, PanelHandle, placeAt, setShown } from './panel-kit';

// BLOC SYSTEM: the engine, wired to the panels.
//
// Every pinch on a panel button becomes a Control. applyControl (pure, in
// src/bloc) turns it into commands, checks them with the engine's
// resolveCommand and appends the events. This system then saves the run,
// re-projects it and writes the new strings into the panels. Nothing here
// decides what a pinch means or what the report says; that is all in
// src/bloc and covered by tests.

const TICK_SECONDS = 0.25; // how often the timer is redrawn

const VERDICT_COLOR: Record<Verdict, string> = {
  followed: '#4cc38a',
  minor_deviations: '#f5d90a',
  major_deviations: '#f0883e',
  not_followed: '#e5484d',
};
const NO_VERDICT = '#5b5e66';

const BADGE_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  Critical: { backgroundColor: '#e5484d', color: '#ffffff' },
  Required: { backgroundColor: '#d8dbe0', color: '#1c1d20' },
  Minor: { backgroundColor: '#5b5e66', color: '#fafaf7' },
  Optional: { backgroundColor: '#2b2e35', color: '#c9ccd1' },
};

// a strip across the top of the card in focus (the panel's own background
// is a fixed material, so it cannot be tinted)
const CARD_STRIPE: Record<CardTone, { display: string; backgroundColor: string }> = {
  focus: { display: 'flex', backgroundColor: '#f5d90a' },
  paused: { display: 'flex', backgroundColor: '#a9adb5' },
  pending: { display: 'none', backgroundColor: '#f5d90a' },
  done: { display: 'none', backgroundColor: '#f5d90a' },
  skipped: { display: 'none', backgroundColor: '#f5d90a' },
};

const newId = (): string => crypto.randomUUID();
const isoNow = (): string => new Date().toISOString();

export class BlocSystem extends createSystem({
  layouts: { required: [BlocLayout] },
  panels: { required: [BlocPanel, PanelDocument] },
}) {
  private store: KeyValueStore | null = null;
  private run: Run | null = null;
  private history: HistoryEntry[] = [];

  private built = false;
  private entities = new Map<string, Entity>(); // "menu", "focus", "report", "card-3"
  private handles = new Map<string, PanelHandle>();
  private nextTickAt = 0;

  init(): void {
    this.store = browserStore();
    this.run = loadRun(this.store);
    this.history = loadHistory(this.store);

    this.cleanupFuncs.push(
      this.queries.layouts.subscribe('qualify', (entity) => this.build(entity)),
      this.queries.panels.subscribe('qualify', (entity) => this.wire(entity)),
      this.world.visibilityState.subscribe(() => this.render()),
    );
    // the layout root may already exist; qualify does not fire for it
    for (const entity of this.queries.layouts.entities) this.build(entity);
  }

  update(_delta: number, time: number): void {
    if (time < this.nextTickAt) return;
    this.nextTickAt = time + TICK_SECONDS;
    if (this.run) this.render();
  }

  // PANELS: made once, hidden until there is something to show

  private build(layout: Entity): void {
    if (this.built) return;
    this.built = true;
    this.makePanel(layout, 'menu', PANEL_ROLES.Menu, 0, BOARD_SLOT);
    this.makePanel(layout, 'report', PANEL_ROLES.Report, 0, BOARD_SLOT);
    this.makePanel(layout, 'focus', PANEL_ROLES.Focus, 0, FOCUS_SLOT);
    cardSlots(MAX_CARDS).forEach((slot, i) =>
      this.makePanel(layout, `card-${i}`, PANEL_ROLES.Card, i, slot),
    );
  }

  private makePanel(layout: Entity, key: string, role: PanelRole, slot: number, at: Slot): void {
    const entity = this.world.createTransformEntity(undefined, { parent: layout, persistent: true });
    const object = entity.object3D!;
    placeAt(object, at);
    object.scale.setScalar(PANEL_SCALE);
    object.visible = false;
    entity.addComponent(PanelUI, { config: PANEL_URLS[role] });
    entity.addComponent(BlocPanel, { role, slot });
    this.entities.set(key, entity);
  }

  // a panel's UIKitML has loaded: connect its buttons
  private wire(entity: Entity): void {
    const document = entity.getValue(PanelDocument, 'document') as UIKitDocument;
    const role = entity.getValue(BlocPanel, 'role') as PanelRole;
    const slot = entity.getValue(BlocPanel, 'slot') as number;
    const panel = new PanelHandle(entity, document);
    const on = (id: string, handler: () => void) => this.cleanupFuncs.push(panel.on(id, handler));

    switch (role) {
      case PANEL_ROLES.Menu:
        this.handles.set('menu', panel);
        TEMPLATES.forEach((template, i) => {
          panel.text(`choice-${i}-name`, template.name);
          panel.text(`choice-${i}-line`, templateLine(template));
          on(`choice-${i}`, () => this.pick(template));
        });
        on('enter-xr', () => this.world.launchXR());
        break;
      case PANEL_ROLES.Focus:
        this.handles.set('focus', panel);
        on('pause', () => this.control({ kind: 'timer', control: 'pause' }));
        on('end', () => this.control({ kind: 'timer', control: 'end' }));
        break;
      case PANEL_ROLES.Report:
        this.handles.set('report', panel);
        on('again', () => this.reset());
        break;
      case PANEL_ROLES.Card:
        this.handles.set(`card-${slot}`, panel);
        for (const control of ['start', 'done', 'skip'] as const) {
          on(control, () => this.cardControl(slot, control));
        }
        break;
    }
    this.render();
  }

  // ACTIONS

  private pick(template: Template): void {
    if (this.run) return;
    this.run = newRun(template, { userId: DEV_USER_ID, newId, now: isoNow() });
    saveRun(this.store, this.run);
    this.render();
  }

  private reset(): void {
    this.run = null;
    clearRun(this.store);
    this.render();
  }

  // a card slot is matched to its task at the moment of the pinch
  private cardControl(slot: number, control: CardControl): void {
    if (!this.run) return;
    const { state } = viewRun(this.run, isoNow());
    const task = orderedTaskStates(state)[slot];
    if (task) this.control({ kind: 'card', control, taskId: task.taskId });
  }

  private control(control: Control): void {
    if (!this.run) return;
    const at = isoNow();
    const result = applyControl(this.run, control, at, newId);
    if (!result.accepted) return;
    this.run = result.run;
    saveRun(this.store, this.run);
    const entry = entryFromRun(this.run, at);
    if (entry) {
      this.history = addEntry(this.history, entry);
      saveHistory(this.store, this.history);
    }
    this.render();
  }

  // RENDER: show the right panels and write their strings

  private show(key: string, shown: boolean): void {
    const entity = this.entities.get(key);
    // a panel only shows once its UIKitML has loaded and been wired
    if (entity) setShown(entity, shown && this.handles.has(key));
  }

  private render(): void {
    const at = isoNow();
    const view = this.run ? viewRun(this.run, at) : null;
    const finished = view ? isFinished(view.state) : false;
    const cards = this.run && view && !finished ? cardViews(this.run, view, at) : [];

    this.show('menu', !this.run);
    this.show('focus', !!view);
    this.show('report', finished);

    const slots = cardSlots(cards.length);
    for (let i = 0; i < MAX_CARDS; i++) {
      const key = `card-${i}`;
      this.show(key, i < cards.length);
      const panel = this.handles.get(key);
      if (panel && i < cards.length) {
        placeAt(panel.entity.object3D!, slots[i]);
        this.renderCard(panel, cards[i]);
      }
    }

    if (!this.run) this.renderMenu();
    if (view) this.renderFocus(view);
    if (view && finished) this.renderReport(view);
  }

  private renderMenu(): void {
    const panel = this.handles.get('menu');
    if (!panel) return;
    const verdicts = recentVerdicts(this.history, 7);
    for (let i = 0; i < 7; i++) {
      const verdict = verdicts[i];
      panel.set(`dot-${i}`, { backgroundColor: verdict ? VERDICT_COLOR[verdict] : NO_VERDICT });
    }
    panel.text('trend', trendLine(this.history));
    const inBrowser = this.world.visibilityState.peek() === VisibilityState.NonImmersive;
    panel.set('enter-xr', { display: inBrowser && this.world.xrEnabled ? 'flex' : 'none' });
    panel.text(
      'hint',
      inBrowser
        ? 'On a headset, enter mixed reality. Here, click the panels.'
        : 'Pinch the block and move it onto your desk.',
    );
  }

  private renderFocus(view: RunView): void {
    const panel = this.handles.get('focus');
    if (!panel) return;
    const focus = focusView(view);
    panel.text('block-name', focus.blockName.toUpperCase());
    panel.text('clock', focus.clock);
    panel.set('clock', { color: focus.overrun ? '#f0883e' : '#fafaf7' });
    panel.text('caption', focus.caption);
    panel.text('step', focus.step);
    panel.text('title', focus.title);
    panel.set('progress', { value: Math.round(focus.progress * 100) });
    panel.text('pause-label', focus.pauseLabel);
    // Pause and End only mean something while the block is live
    panel.set('actions', { display: focus.canPause || focus.canEnd ? 'flex' : 'none' });
  }

  private renderCard(panel: PanelHandle, card: CardView): void {
    panel.text('number', card.number);
    panel.text('badge', card.badge);
    panel.set('badge', BADGE_STYLE[card.badge] ?? BADGE_STYLE.Required);
    panel.text('estimate', card.estimate);
    panel.text('title', card.title);
    const finished = card.tone === 'done' || card.tone === 'skipped';
    panel.set('title', { color: finished ? '#8b8f97' : '#fafaf7' });
    panel.text('status', card.status);
    panel.set('stripe', CARD_STRIPE[card.tone]);
    panel.text('start-label', card.start.label);
    panel.set('start', { disabled: !card.start.enabled });
    panel.set('done', { disabled: !card.done });
    panel.set('skip', { disabled: !card.skip });
  }

  private renderReport(view: RunView): void {
    const panel = this.handles.get('report');
    const report = reportView(view);
    if (!panel || !report) return;
    panel.text('block-name', `${view.state.name.toUpperCase()} REPORT`);
    panel.text('score', report.score);
    panel.text('verdict', report.verdictLabel);
    panel.set('verdict', { color: VERDICT_COLOR[report.verdict] });
    panel.text('verdict-note', report.verdictNote);
    for (let i = 0; i < 4; i++) {
      const line = report.deviations[i];
      panel.text(`line-${i}`, line ?? '');
      panel.set(`line-${i}`, { display: line ? 'flex' : 'none' });
    }
    panel.text('points', report.points);
    panel.text('rules', `Checked against: ${report.rules}.`);
    panel.text('focus', report.focus);
  }
}
