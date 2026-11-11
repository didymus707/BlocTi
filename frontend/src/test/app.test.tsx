import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createLocalPersistence,
  PersistenceError,
  type AppendRequest,
  type SeiPersistence,
} from "../sei/store/persistence";
import { createTestClock, renderApp, settle } from "./renderApp";

const createBlock = async (
  name = "Morning",
  minutes = "30",
  tasks: [string, string][] = [
    ["Read", "10"],
    ["Write", "20"],
  ],
) => {
  fireEvent.click(await screen.findByRole("button", { name: "New block" }));
  const dialog = within(screen.getByRole("dialog", { name: "New block" }));
  fireEvent.change(dialog.getByLabelText("Name"), { target: { value: name } });
  fireEvent.change(dialog.getByLabelText("Minutes"), { target: { value: minutes } });
  for (const [task, taskMinutes] of tasks) {
    fireEvent.change(dialog.getByLabelText("Task name"), { target: { value: task } });
    fireEvent.change(dialog.getByLabelText("Task minutes"), { target: { value: taskMinutes } });
    fireEvent.click(dialog.getByRole("button", { name: "Add" }));
  }
  fireEvent.click(dialog.getByRole("button", { name: "Create block" }));
  await settle();
};

// the card (or agent row) that links to a block
const blockLink = (name: string) => {
  const link = screen
    .getAllByRole("link")
    .find((a) => a.getAttribute("href")?.startsWith("/block/") && a.textContent?.includes(name));
  if (!link) throw new Error(`no link to block "${name}"`);
  return link;
};

const openBlock = async (name = "Morning") => {
  await screen.findAllByText(name);
  fireEvent.click(blockLink(name));
  await screen.findByRole("heading", { level: 1, name });
};

const goToday = () => fireEvent.click(screen.getByRole("link", { name: "BlocTi" }));

const status = () => screen.getByTestId("block-status").textContent;
const currentTask = () => screen.queryByTestId("current-task")?.textContent ?? null;
const elapsed = () => screen.queryByTestId("task-elapsed")?.textContent ?? null;
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const metric = (label: string) => within(screen.getByRole("group", { name: label }));

describe("BlocTi app on SEI", () => {
  it("creates a block and shows it as planned on Today", async () => {
    renderApp();
    await createBlock();
    expect(screen.getByText("Morning")).toBeInTheDocument();
    expect(status()).toBe("Planned");
    expect(screen.getByText(/2 tasks · 30m budget/)).toBeInTheDocument();
  });

  it("can create a block and start it in one step", async () => {
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "New block" }));
    const dialog = within(screen.getByRole("dialog", { name: "New block" }));
    fireEvent.change(dialog.getByLabelText("Name"), { target: { value: "Quick" } });
    fireEvent.click(dialog.getByRole("button", { name: "30m" }));
    fireEvent.change(dialog.getByLabelText("Task name"), { target: { value: "Only task" } });
    fireEvent.change(dialog.getByLabelText("Task minutes"), { target: { value: "30" } });
    fireEvent.keyDown(dialog.getByLabelText("Task minutes"), { key: "Enter" });
    expect(dialog.getByText("Fits exactly")).toBeInTheDocument();
    fireEvent.click(dialog.getByLabelText("Start right away"));
    fireEvent.click(dialog.getByRole("button", { name: "Create block" }));
    await screen.findByRole("heading", { level: 1, name: "Quick" });
    expect(status()).toBe("Running");
    expect(currentTask()).toBe("Only task");
  });

  it("runs a full session and shows real drift and fidelity from SEI", async () => {
    const { clock } = renderApp();
    await createBlock();
    await openBlock();

    click("Start session");
    await waitFor(() => expect(status()).toBe("Running"));
    expect(currentTask()).toBe("Read");

    clock.advance(300);
    await waitFor(() => expect(elapsed()).toBe("05:00"));

    click("Pause");
    expect(status()).toBe("Paused");
    clock.advance(60);
    await settle();
    expect(elapsed()).toBe("05:00");

    click("Resume");
    click("Complete task");
    expect(currentTask()).toBe("Write");

    clock.advance(1200);
    await waitFor(() => expect(elapsed()).toBe("20:00"));
    click("Complete task");
    await waitFor(() => expect(status()).toBe("Completed"));

    // Read: 5m of 10m (accuracy 0.5), Write: 20m of 20m; wall 26m vs 30m budget
    expect(screen.getByTestId("fidelity-score")).toHaveTextContent("95%");
    expect(metric("Execution drift").getByText("−4m")).toBeInTheDocument();
    expect(metric("Focus variance").getByText("−5m")).toBeInTheDocument();
    expect(metric("Paused").getByText("1m")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run again" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Event trace" })).getByText("BlockCompleted")).toBeInTheDocument();
  });

  it("keeps a trace across a page refresh", async () => {
    const clock = createTestClock();
    const first = renderApp({ clock });
    await createBlock();
    await openBlock();
    click("Start session");
    clock.advance(120);
    await waitFor(() => expect(elapsed()).toBe("02:00"));
    click("Pause");
    await settle();
    first.unmount();

    clock.advance(600);
    renderApp({ clock });
    await openBlock();
    expect(status()).toBe("Paused");
    expect(currentTask()).toBe("Read");
    expect(elapsed()).toBe("02:00");
    expect(metric("Paused").getByText("10m · 1×")).toBeInTheDocument();
  });

  it("retries a lost response with the same idempotency key and stores no duplicates", async () => {
    const inner = createLocalPersistence();
    const keys: string[] = [];
    let dropNextResponse = true;
    const flaky: SeiPersistence = {
      ...inner,
      appendEvents: async (request: AppendRequest) => {
        keys.push(request.idempotencyKey);
        const stored = await inner.appendEvents(request);
        if (dropNextResponse) {
          // the server stored it, but the client never hears back
          dropNextResponse = false;
          throw new PersistenceError("Network error: connection reset", true);
        }
        return stored;
      },
    };

    renderApp({ persistence: flaky });
    await createBlock();
    await openBlock();
    click("Start session");
    await waitFor(() => expect(screen.getByText(/offline/i)).toBeInTheDocument());

    await waitFor(() => expect(screen.getByText(/all events saved/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    const stored = await inner.load();
    expect(stored.events.map((e) => e.type)).toEqual([
      "BlockPlanned",
      "BlockStarted",
      "TaskStarted",
    ]);
    expect(new Set(stored.events.map((e) => e.eventId)).size).toBe(3);
  });

  it("rolls back events the server rejects and tells the user", async () => {
    const inner = createLocalPersistence();
    const rejecting: SeiPersistence = {
      ...inner,
      appendEvents: async () => {
        throw new PersistenceError("occurredAt is outside the allowed clock skew", false, 422);
      },
    };
    renderApp({ persistence: rejecting });
    await createBlock();
    await openBlock();
    click("Start session");
    await waitFor(() => expect(status()).toBe("Planned"));
    expect(await screen.findByText(/could not save: occurredAt/i)).toBeInTheDocument();
    expect((await inner.load()).events).toEqual([]);
  });

  it("falls back to the local cache when the backend is unreachable", async () => {
    const first = renderApp();
    await createBlock();
    await settle();
    first.unmount();

    const down: SeiPersistence = {
      ...createLocalPersistence(),
      kind: "http",
      load: async () => {
        throw new PersistenceError("Network error: ECONNREFUSED", true);
      },
    };
    // the local store is wiped; only the app's cache remembers the block
    localStorage.removeItem("blocti:sei:v1");
    renderApp({ persistence: down });
    expect(await screen.findByText("Morning")).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it("migrates blocks saved by the old reducer system", async () => {
    localStorage.setItem(
      "blocks",
      JSON.stringify([
        {
          id: "legacy-1",
          name: "Old routine",
          plannedDuration: 45,
          createdAt: "2026-01-01T00:00:00.000Z",
          tasks: [{ id: "lt-1", name: "Stretch", duration: 15 }],
        },
      ]),
    );
    renderApp();
    await openBlock("Old routine");
    expect(screen.getByRole("button", { name: "Start with Stretch" })).toBeInTheDocument();
  });

  it("switches tasks from the plan and keeps the first task's time", async () => {
    const { clock } = renderApp();
    await createBlock();
    await openBlock();
    click("Start session");
    clock.advance(90);
    await waitFor(() => expect(elapsed()).toBe("01:30"));
    click("Switch to Write");
    expect(currentTask()).toBe("Write");
    expect(screen.getByText("01:30 / 10m")).toBeInTheDocument();
  });

  it("adds a task to a running block without disturbing the current one", async () => {
    renderApp();
    await createBlock();
    await openBlock();
    click("Start session");
    click("Add task");
    const dialog = within(screen.getByRole("dialog", { name: "Add task" }));
    fireEvent.change(dialog.getByLabelText("New task name"), { target: { value: "Ship" } });
    fireEvent.change(dialog.getByLabelText("New task minutes"), { target: { value: "5" } });
    fireEvent.click(dialog.getByRole("button", { name: "Add task" }));
    await waitFor(() => expect(screen.getByText("Ship")).toBeInTheDocument());
    expect(currentTask()).toBe("Read");
    click("Complete task");
    click("Complete task");
    expect(currentTask()).toBe("Ship");
  });

  it("editing a finished block's plan does not rewrite its history", async () => {
    renderApp();
    await createBlock("Morning", "30", [["Read", "10"]]);
    await openBlock();
    click("Start session");
    click("Complete task");
    await waitFor(() => expect(status()).toBe("Completed"));

    click("Edit plan");
    const dialog = within(screen.getByRole("dialog", { name: "Edit plan" }));
    expect(dialog.getByText(/recorded history stays as it happened/)).toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText("Task 1 name"), { target: { value: "Renamed" } });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await settle();

    expect(within(screen.getByRole("region", { name: "Plan vs actual" })).getByText("Read")).toBeInTheDocument();
    expect(screen.queryByText("Renamed")).not.toBeInTheDocument();
  });

  it("run again copies the plan into a fresh planned block", async () => {
    renderApp();
    await createBlock("Morning", "30", [["Read", "10"]]);
    await openBlock();
    click("Start session");
    click("Stop session");
    await waitFor(() => expect(status()).toBe("Stopped"));
    click("Run again");
    await waitFor(() => expect(status()).toBe("Planned"));
    goToday();
    await waitFor(() => expect(screen.getAllByText("Morning")).toHaveLength(2));
    const statuses = screen.getAllByTestId("block-status").map((s) => s.textContent);
    expect(statuses).toEqual(["Stopped", "Planned"]);
  });

  it("starting a second block puts the first on a break", async () => {
    renderApp();
    await createBlock("First", "30", [["A", "10"]]);
    await createBlock("Second", "30", [["B", "10"]]);
    await openBlock("First");
    click("Start session");
    goToday();
    await openBlock("Second");
    click("Start session");
    goToday();
    await screen.findByRole("region", { name: "Live session" });
    const statuses = screen.getAllByTestId("block-status").map((s) => s.textContent);
    expect(statuses).toEqual(["On a break", "Running"]);
  });

  it("asks before deleting a block and its trace", async () => {
    const persistence = createLocalPersistence();
    renderApp({ persistence });
    await createBlock();
    await openBlock();
    click("Start session");
    expect((await persistence.load()).events).toHaveLength(3);
    click("Delete block");
    expect(screen.getByText(/deletes its trace too/i)).toBeInTheDocument();
    click("Keep");
    expect(status()).toBe("Running");
    click("Delete block");
    click("Confirm delete");
    await screen.findByText(/no blocks yet/i);
    await settle();
    const stored = await persistence.load();
    expect(stored.blockPlans).toEqual([]);
    expect(stored.events).toEqual([]);
  });

  it("focus mode shows the live task full screen and controls it", async () => {
    const { clock } = renderApp();
    await createBlock();
    await openBlock();
    click("Start session");
    click("Focus mode");
    await screen.findByRole("region", { name: "Current focus" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Read");
    clock.advance(60);
    await waitFor(() => expect(screen.getByRole("timer")).toHaveTextContent("09:00"));
    click("Pause");
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    click("Resume");
    click("Done");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Write");
    fireEvent.click(screen.getByRole("link", { name: "Exit focus mode" }));
    await screen.findByRole("heading", { level: 1, name: "Morning" });
  });

  it("shows agent-captured blocks read-only and keeps them out of fidelity", async () => {
    const persistence = createLocalPersistence();
    const base = {
      blockId: "cc-1",
      sessionId: "cc-session",
      userId: "dev-user",
      actor: "agent",
      source: "agent_hook",
      evidence: "observed",
    };
    const at = (sec: number) => new Date(Date.parse("2026-11-08T08:00:00.000Z") + sec * 1000).toISOString();
    const tasks = [{ taskId: "cc-1:p1", title: "Fix the login bug", plannedDuration: 0 }];
    await persistence.appendEvents({
      idempotencyKey: "seed",
      blockId: "cc-1" as never,
      events: [
        { ...base, type: "BlockPlanned", name: "Claude Code · blocTi", plannedDuration: 0, tasks: [], occurredAt: at(0) },
        { ...base, type: "BlockStarted", occurredAt: at(0) },
        { ...base, type: "BlockPaused", evidence: "inferred", reason: "waiting for prompt", occurredAt: at(0) },
        { ...base, type: "BlockPlanned", name: "Claude Code · blocTi", plannedDuration: 0, tasks, occurredAt: at(120) },
        { ...base, type: "TaskStarted", taskId: "cc-1:p1", occurredAt: at(120) },
        { ...base, type: "TaskCompleted", taskId: "cc-1:p1", occurredAt: at(420) },
        { ...base, type: "BlockCompleted", occurredAt: at(420) },
      ].map((e, i) => ({ ...e, eventId: `seed-${i}`, seq: i + 1 })) as never,
    });

    renderApp({ persistence });
    await openBlock("Claude Code · blocTi");
    expect(status()).toBe("Completed");
    expect(screen.getByText(/plan was inferred afterwards/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run again" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit plan" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Turns" })).getByText("Fix the login bug")).toBeInTheDocument();
    expect(metric("Agent working").getByText("5m")).toBeInTheDocument();
    expect(metric("Waiting on you").getByText("2m")).toBeInTheDocument();
    expect(metric("Turn completion").getByText("100%")).toBeInTheDocument();

    // on Today, agent time is reported apart and kept out of fidelity
    goToday();
    await screen.findByRole("region", { name: "Agent sessions" });
    expect(metric("Agent time").getByText("5m")).toBeInTheDocument();
    expect(metric("Avg fidelity").getByText("—")).toBeInTheDocument();
    expect(metric("Focus time").getByText("0s")).toBeInTheDocument();
  });
});
