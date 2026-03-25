import type { SeiEvent } from "./events";

// create an event helper that inserts a new event into an event stream
export const appendEvent = <T extends SeiEvent>(
  events: SeiEvent[],
  newEvent: Omit<T, "seq" | "occurredAt">,
): SeiEvent[] => {
  const nextSeq = events.length === 0 ? 1 : events[events.length - 1].seq + 1;
  const event = {
    ...newEvent,
    seq: nextSeq,
    occurredAt: new Date().toISOString(),
  } as T;
  return [...events, event];
};
