import { describe, expect, it } from "vitest";
import { appendEvents, materializeEvents } from "../append";
import type { CommandResult } from "../command/resolver";
import type { SeiEvent } from "../events";
import { BLOCK, OTHER_BLOCK, deepFreeze, ev, idSequence, sequence, started } from "./builders";

const payload = (e: SeiEvent) => {
  const { eventId: _eventId, seq: _seq, ...rest } = e;
  return rest as CommandResult;
};

describe("appendEvents", () => {
  it("returns the existing stream followed by the new events", () => {
    const existing = sequence(...started(0));
    const result = appendEvents(existing, [payload(sequence(ev.taskPaused("task-1" as never, 5))[0])], idSequence());
    expect(result).toHaveLength(4);
    expect(result.slice(0, 3)).toEqual(existing);
    expect(result[3]).toMatchObject({ type: "TaskPaused", seq: 4, eventId: "id-1" });
  });

  it("starts seq at 1 for an empty stream", () => {
    const result = appendEvents([], [payload(sequence(ev.blockStarted(0))[0])], idSequence());
    expect(result[0].seq).toBe(1);
  });

  it("continues from the highest seq even if the stream is unsorted", () => {
    const existing = sequence(...started(0)).reverse();
    const result = appendEvents(existing, [payload(sequence(ev.blockPaused(5))[0])], idSequence());
    expect(result[3].seq).toBe(4);
  });

  it("numbers each block's stream independently", () => {
    const other = sequence(ev.blockStarted(0)).map((e) => ({ ...e, blockId: OTHER_BLOCK, seq: 7 }));
    const existing = [...sequence(...started(0)), ...other];
    const [a, b] = materializeEvents(
      existing,
      [
        payload({ ...sequence(ev.blockPaused(1))[0], blockId: OTHER_BLOCK } as SeiEvent),
        payload({ ...sequence(ev.blockPaused(1))[0], blockId: BLOCK } as SeiEvent),
      ],
      idSequence(),
    );
    expect(a).toMatchObject({ blockId: OTHER_BLOCK, seq: 8 });
    expect(b).toMatchObject({ blockId: BLOCK, seq: 4 });
  });

  it("assigns consecutive seqs to a multi-event command", () => {
    const results = appendEvents([], sequence(...started(0)).map(payload), idSequence("e"));
    expect(results.map((e) => [e.seq, e.eventId])).toEqual([
      [1, "e-1"],
      [2, "e-2"],
      [3, "e-3"],
    ]);
  });

  it("does not mutate the existing stream", () => {
    const existing = deepFreeze(sequence(...started(0)));
    expect(() =>
      appendEvents(existing, [payload(sequence(ev.blockPaused(5))[0])], idSequence()),
    ).not.toThrow();
  });
});
