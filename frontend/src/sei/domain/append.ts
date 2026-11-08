import type { CommandResult } from "./command/resolver";
import type { SeiEvent } from "./events";
import type { EventId } from "./ids";

type MaterializedEvent<T extends CommandResult> = T & {
  eventId: EventId;
  seq: number;
};

const materializeEvent = <T extends CommandResult>(
  event: T,
  seq: number,
): MaterializedEvent<T> => ({
  ...event,
  eventId: crypto.randomUUID() as EventId,
  seq,
});

// create an event helper that inserts a new event into an event stream
export const appendEvents = (
  existingEvents: SeiEvent[],
  newEvents: CommandResult[],
): SeiEvent[] => {
  const lastSeq = existingEvents.length
    ? existingEvents[existingEvents.length - 1].seq
    : -1;

  return newEvents.map((event, index) =>
    materializeEvent(event, lastSeq + index + 1),
  );
};
