import { createHash, randomUUID } from "node:crypto";
import { Prisma, type Event as EventRow, type PrismaClient } from "@prisma/client";
import { HttpError } from "./errors.js";
import type { EventInput } from "./validation.js";

export interface StoreConfig {
  now: () => Date;
  maxClockSkewSec: number;
}

export type StoredEvent = Record<string, unknown> & {
  eventId: string;
  blockId: string;
  seq: number;
  type: string;
  occurredAt: string;
  recordedAt: string;
};

const COLUMNS = [
  "eventId",
  "blockId",
  "type",
  "userId",
  "sessionId",
  "actor",
  "source",
  "evidence",
  "occurredAt",
] as const;

export const rowToEvent = (row: EventRow): StoredEvent => ({
  ...(row.payload as Record<string, unknown>),
  eventId: row.eventId,
  blockId: row.blockId,
  seq: row.seq,
  type: row.type,
  userId: row.userId,
  sessionId: row.sessionId,
  actor: row.actor,
  source: row.source,
  evidence: row.evidence,
  occurredAt: row.occurredAt.toISOString(),
  recordedAt: row.recordedAt.toISOString(),
});

// the event minus its columns: taskId, reason, tasks, name, ...
const payloadOf = (event: EventInput): Prisma.InputJsonObject => {
  const payload: Record<string, unknown> = { ...event };
  for (const column of COLUMNS) delete payload[column];
  return payload as Prisma.InputJsonObject;
};

const hashRequest = (events: EventInput[]) =>
  createHash("sha256").update(JSON.stringify(events)).digest("hex");

const isUniqueViolation = (error: unknown, target?: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002" &&
  (!target || JSON.stringify(error.meta ?? {}).includes(target));

export interface AppendResult {
  events: StoredEvent[];
  replayed: boolean;
}

// Appends one command's events to a block stream.
// - seq and recordedAt are assigned here, never by the client
// - occurredAt may come from the client but must be within maxClockSkewSec of
//   server time and must not go backwards within the block
// - the same Idempotency-Key with the same body returns the original result;
//   with a different body it is rejected
export async function appendEvents(
  prisma: PrismaClient,
  config: StoreConfig,
  input: { userId: string; idempotencyKey: string; events: EventInput[] },
): Promise<AppendResult> {
  const { userId, idempotencyKey, events } = input;
  const blockId = events[0]!.blockId;
  const key = `${userId}:${idempotencyKey}`;
  const requestHash = hashRequest(events);

  const attempt = () =>
    prisma.$transaction(async (tx) => {
      // serialise writers per block so seq has no gaps or races
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${blockId}))`;

      const previous = await tx.idempotencyRecord.findUnique({ where: { key } });
      if (previous) {
        if (previous.requestHash !== requestHash) {
          throw new HttpError(
            422,
            "idempotency_key_reused",
            "this Idempotency-Key was already used for a different request",
          );
        }
        const rows = await tx.event.findMany({
          where: { eventId: { in: previous.eventIds } },
          orderBy: { seq: "asc" },
        });
        return { events: rows.map(rowToEvent), replayed: true };
      }

      const last = await tx.event.findFirst({ where: { blockId }, orderBy: { seq: "desc" } });
      if (last && last.userId !== userId) {
        throw new HttpError(403, "forbidden", "this block belongs to another user");
      }

      const now = config.now();
      let floor = last?.occurredAt ?? null;
      const prepared = events.map((event, index) => {
        const occurredAt = event.occurredAt ? new Date(event.occurredAt) : now;
        const skewSec = Math.abs(occurredAt.getTime() - now.getTime()) / 1000;
        if (skewSec > config.maxClockSkewSec) {
          throw new HttpError(
            422,
            "clock_skew",
            `occurredAt is ${Math.round(skewSec)}s from server time (max ${config.maxClockSkewSec}s)`,
            { index, occurredAt: event.occurredAt, serverTime: now.toISOString() },
          );
        }
        if (floor && occurredAt < floor) {
          throw new HttpError(
            422,
            "out_of_order",
            "occurredAt is earlier than the previous event in this block",
            { index, occurredAt: event.occurredAt, previous: floor.toISOString() },
          );
        }
        floor = occurredAt;
        return {
          eventId: event.eventId ?? randomUUID(),
          blockId,
          seq: (last?.seq ?? 0) + index + 1,
          type: event.type,
          userId,
          sessionId: event.sessionId,
          actor: event.actor,
          source: event.source,
          evidence: event.evidence,
          occurredAt,
          recordedAt: now,
          idempotencyKey,
          payload: payloadOf(event),
        };
      });

      const ids = prepared.map((e) => e.eventId);
      if (new Set(ids).size !== ids.length) {
        throw new HttpError(400, "duplicate_event", "eventIds within a request must be unique");
      }
      const clash = await tx.event.findFirst({ where: { eventId: { in: ids } } });
      if (clash) {
        throw new HttpError(409, "duplicate_event", `event ${clash.eventId} already exists`);
      }

      await tx.event.createMany({ data: prepared });
      await tx.idempotencyRecord.create({
        data: { key, userId, blockId, requestHash, eventIds: ids },
      });
      const rows = await tx.event.findMany({
        where: { eventId: { in: ids } },
        orderBy: { seq: "asc" },
      });
      return { events: rows.map(rowToEvent), replayed: false };
    });

  try {
    return await attempt();
  } catch (error) {
    // the same key raced in on another block's lock: the record exists now,
    // so a second attempt takes the replay (or mismatch) path
    if (isUniqueViolation(error, "key")) return attempt();
    if (isUniqueViolation(error, "eventId")) {
      throw new HttpError(409, "duplicate_event", "an event with this eventId already exists");
    }
    throw error;
  }
}

export async function listEvents(
  prisma: PrismaClient,
  userId: string,
  blockId?: string,
): Promise<StoredEvent[]> {
  const rows = await prisma.event.findMany({
    where: { userId, ...(blockId ? { blockId } : {}) },
    orderBy: [{ blockId: "asc" }, { seq: "asc" }],
  });
  return rows.map(rowToEvent);
}
