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
  fireEvent.click(await screen.findByRole("button", { name: /add block/i }));
  fireEvent.change(screen.getByLabelText("Session Name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Total Minutes"), { target: { value: minutes } });
  for (const [task, taskMinutes] of tasks) {
    fireEvent.change(screen.getByLabelText("Task name"), { target: { value: task } });
    fireEvent.change(screen.getByLabelText("Task minutes"), { target: { value: taskMinutes } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Create Session" }));
  await settle();
};

const openBlock = async (name = "Morning") => {
  fireEvent.click(await screen.findByText(name));
  await screen.findByRole("button", { name: /back/i });
};

const status = () => screen.getByTestId("block-status").textContent;
const currentTask = () => screen.queryByTestId("current-task")?.textContent ?? null;
const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));
const metric = (label: string) => within(screen.getByLabelText(label));

// waits for the provider's clock tick to pick up a clock.advance()
const waitForText = (container: ReturnType<typeof within>, text: string) =>
  waitFor(() => expect(container.getByText(text)).toBeInTheDocument());

describe("BlocTi app on SEI", () => {
  it("creates a block and shows it idle on the home page", async () => {
    renderApp();
    await createBlock();
    expect(screen.getByText("Morning")).toBeInTheDocument();
    expect(status()).toBe("idle");
    expect(screen.getByText("2 tasks")).toBeInTheDocument();
  });

  it("runs a full session and shows real drift and fidelity from SEI", async () => {
    const { clock } = renderApp();
    await createBlock();
    await openBlock();

    click("Start Session");
    await waitFor(() => expect(status()).toBe("running"));
    expect(currentTask()).toBe("Read");

    clock.advance(300);
    await waitForText(within(screen.getByLabelText("Task Progress")), "Elapsed: 05:00");

    click("Pause");
    expect(status()).toBe("paused");
    clock.advance(60);
    await settle();
    expect(
      within(screen.getByLabelText("Task Progress")).getByText("Elapsed: 05:00"),
    ).toBeInTheDocument();

    click("Resume");
    click("Complete Task");
    expect(currentTask()).toBe("Write");

    clock.advance(1200);
    await waitForText(within(screen.getByLabelText("Task Progress")), "Elapsed: 20:00");
    click("Complete Task");
    await waitFor(() => expect(status()).toBe("completed"));

    // Read: 5m of 10m (accuracy 0.5), Write: 20m of 20m; wall 26m vs 30m budget
    expect(metric("Fidelity").getByText("95%")).toBeInTheDocument();
    expect(metric("Execution Drift").getByText("−4m")).toBeInTheDocument();
    expect(metric("Focus Variance").getByText("−5m")).toBeInTheDocument();
    expect(metric("Pauses").getByText("1m")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Again" })).toBeInTheDocument();
  });

  it("keeps a trace across a page refresh", async () => {
    const clock = createTestClock();
    const first = renderApp({ clock });
    await createBlock();
    await openBlock();
    click("Start Session");
    clock.advance(120);
    await waitForText(within(screen.getByLabelText("Task Progress")), "Elapsed: 02:00");
    click("Pause");
    await settle();
    first.unmount();

    clock.advance(600);
    renderApp({ clock });
    await openBlock();
    expect(status()).toBe("paused");
    expect(currentTask()).toMatch(/^Read/);
    expect(
      within(screen.getByLabelText("Task Progress")).getByText("Elapsed: 02:00"),
    ).toBeInTheDocument();
    expect(metric("Pauses").getByText("10m")).toBeInTheDocument();
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
    click("Start Session");
    await waitFor(() => expect(screen.getByText(/offline/i)).toBeInTheDocument());

    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument(), {
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
    click("Start Session");
    await waitFor(() => expect(status()).toBe("idle"));
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
    expect(await screen.findByText("Old routine")).toBeInTheDocument();
    await openBlock("Old routine");
    expect(screen.getByRole("button", { name: "Stretch" })).toBeInTheDocument();
  });

  it("switches tasks by clicking the queue and counts the switch", async () => {
    renderApp();
    await createBlock();
    await openBlock();
    click("Start Session");
    click("Write");
    expect(currentTask()).toBe("Write");
    expect(screen.getByRole("button", { name: "Read" })).toBeInTheDocument();
  });

  it("adds a task to a running block without disturbing the current one", async () => {
    renderApp();
    await createBlock();
    await openBlock();
    click("Start Session");
    click("+ Add");
    fireEvent.change(screen.getByLabelText("New task name"), { target: { value: "Ship" } });
    fireEvent.change(screen.getByLabelText("New task minutes"), { target: { value: "5" } });
    click("Add Task");
    await waitFor(() => expect(screen.getByRole("button", { name: "Ship" })).toBeInTheDocument());
    expect(currentTask()).toBe("Read");
    click("Complete Task");
    click("Complete Task");
    expect(currentTask()).toBe("Ship");
  });

  it("editing a finished block's plan does not rewrite its history", async () => {
    renderApp();
    await createBlock("Morning", "30", [["Read", "10"]]);
    await openBlock();
    click("Start Session");
    click("Complete Task");
    await waitFor(() => expect(status()).toBe("completed"));

    click("Edit block");
    fireEvent.click(screen.getByRole("button", { name: "edit Read" }));
    fireEvent.change(screen.getByLabelText("Edit task name"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "save task" }));
    click("Save Changes");
    await settle();

    expect(screen.getByRole("button", { name: "Read done" })).toBeInTheDocument();
    expect(screen.queryByText("Renamed")).not.toBeInTheDocument();
  });

  it("run again copies the plan into a fresh idle block", async () => {
    renderApp();
    await createBlock("Morning", "30", [["Read", "10"]]);
    await openBlock();
    click("Start Session");
    click("Stop Session");
    expect(status()).toBe("stopped");
    click("Run Again");
    await waitFor(() => expect(status()).toBe("idle"));
    fireEvent.click(screen.getByRole("link", { name: "BlocTi" }));
    await waitFor(() => expect(screen.getAllByText("Morning")).toHaveLength(2));
    const statuses = screen.getAllByTestId("block-status").map((s) => s.textContent);
    expect(statuses).toEqual(["stopped", "idle"]);
  });

  it("starting a second block pauses the one already running", async () => {
    renderApp();
    await createBlock("First", "30", [["A", "10"]]);
    await createBlock("Second", "30", [["B", "10"]]);
    await openBlock("First");
    click("Start Session");
    click(/back/i);
    await openBlock("Second");
    click("Start Session");
    click(/back/i);
    await screen.findByText("First");
    const statuses = screen.getAllByTestId("block-status").map((s) => s.textContent);
    expect(statuses).toEqual(["paused", "running"]);
  });

  it("shows agent-captured blocks read-only, with inferred pauses called out", async () => {
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
    expect(status()).toBe("completed");
    expect(screen.getByText(/captured automatically by an agent hook/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run Again" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fix the login bug done" })).toBeDisabled();
    expect(metric("Focus Time").getByText("5m")).toBeInTheDocument();
    expect(metric("Pauses").getByText("2m inferred")).toBeInTheDocument();

    // on the overview, agent time is reported apart and kept out of fidelity
    fireEvent.click(screen.getByRole("link", { name: "BlocTi" }));
    await screen.findByText("Sessions Overview");
    expect(metric("Agent Time").getByText("5m")).toBeInTheDocument();
    expect(metric("Avg Fidelity").getByText("—")).toBeInTheDocument();
    expect(metric("Focus Time").getByText("0s")).toBeInTheDocument();
    expect(screen.getByText("agent")).toBeInTheDocument();
  });

  it("deletes a block and its trace", async () => {
    const persistence = createLocalPersistence();
    renderApp({ persistence });
    await createBlock();
    await openBlock();
    click("Start Session");
    expect((await persistence.load()).events).toHaveLength(3);
    click("Delete block");
    await screen.findByText(/no blocks yet/i);
    await settle();
    const stored = await persistence.load();
    expect(stored.blockPlans).toEqual([]);
    expect(stored.events).toEqual([]);
  });
});
