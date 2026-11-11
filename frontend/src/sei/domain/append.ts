import type { CommandResult } from "./command/resolver";
import type { SeiEvent } from "./events";
import type { BlockId, EventId, IdGenerator } from "./ids";

// highest seq per block; seq is per block stream and starts at 1
export const lastSeqByBlock = (events: SeiEvent[]): Map<BlockId, number> => {
  const seqs = new Map<BlockId, number>();
  for (const e of events) {
    seqs.set(e.blockId, Math.max(seqs.get(e.blockId) ?? 0, e.seq));
  }
  return seqs;
};

// gives payloads the stream metadata (eventId, seq) the resolver leaves out
export const materializeEvents = (
  existingEvents: SeiEvent[],
  newEvents: CommandResult[],
  generateId: IdGenerator,
): SeiEvent[] => {
  const seqs = lastSeqByBlock(existingEvents);
  return newEvents.map((event) => {
    const seq = (seqs.get(event.blockId) ?? 0) + 1;
    seqs.set(event.blockId, seq);
    return { ...event, eventId: generateId() as EventId, seq } as SeiEvent;
  });
};

// returns the whole stream: existing events followed by the new ones
export const appendEvents = (
  existingEvents: SeiEvent[],
  newEvents: CommandResult[],
  generateId: IdGenerator,
): SeiEvent[] => [
  ...existingEvents,
  ...materializeEvents(existingEvents, newEvents, generateId),
];
