import express, { type Request } from "express";
import cors from "cors";
import type { PrismaClient } from "@prisma/client";
import { errorHandler, HttpError } from "./errors.js";
import { appendEvents, listEvents, type StoreConfig } from "./eventStore.js";
import {
  appendRequestSchema,
  idempotencyKeySchema,
  savePlanSchema,
} from "./validation.js";

export const DEV_USER_ID = "dev-user";

// no auth yet: the caller names itself, defaulting to the dev user
const userOf = (req: Request) => {
  const header = req.header("x-user-id")?.trim();
  return header && header.length <= 200 ? header : DEV_USER_ID;
};

export function createApp(prisma: PrismaClient, config: StoreConfig) {
  const app = express();

  app.use(cors({ exposedHeaders: ["Idempotent-Replayed"] }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // PLANS
  app.get("/blocks", async (req, res) => {
    const rows = await prisma.block.findMany({
      where: { userId: userOf(req) },
      orderBy: { createdAt: "asc" },
    });
    res.json({
      blocks: rows.map((b) => {
        const tasks = b.tasks as { id: string }[];
        return {
          id: b.id,
          name: b.name,
          userId: b.userId,
          taskIds: tasks.map((t) => t.id),
          createdAt: b.createdAt.toISOString(),
          plannedDuration: b.plannedDuration,
        };
      }),
      tasks: rows.flatMap((b) => b.tasks as unknown[]),
    });
  });

  app.put("/blocks/:id", async (req, res) => {
    const userId = userOf(req);
    const { block, tasks } = savePlanSchema.parse(req.body);
    if (block.id !== req.params.id) {
      throw new HttpError(400, "id_mismatch", "block.id does not match the URL");
    }
    if (tasks.some((t) => t.blockId !== block.id)) {
      throw new HttpError(400, "id_mismatch", "every task must belong to the block");
    }
    const existing = await prisma.block.findUnique({ where: { id: block.id } });
    if (existing && existing.userId !== userId) {
      throw new HttpError(403, "forbidden", "this block belongs to another user");
    }
    const ordered = [...tasks].sort((a, b) => a.order - b.order);
    const data = {
      name: block.name,
      plannedDuration: block.plannedDuration,
      tasks: ordered,
    };
    await prisma.block.upsert({
      where: { id: block.id },
      create: { id: block.id, userId, createdAt: new Date(block.createdAt), ...data },
      update: data,
    });
    res.json({ block: { ...block, userId, taskIds: ordered.map((t) => t.id) }, tasks: ordered });
  });

  // deleting a block deletes its trace; events are never edited in place
  app.delete("/blocks/:id", async (req, res) => {
    const userId = userOf(req);
    const blockId = req.params.id;
    const owner =
      (await prisma.block.findUnique({ where: { id: blockId } }))?.userId ??
      (await prisma.event.findFirst({ where: { blockId } }))?.userId;
    if (owner && owner !== userId) {
      throw new HttpError(403, "forbidden", "this block belongs to another user");
    }
    await prisma.$transaction([
      prisma.event.deleteMany({ where: { blockId } }),
      prisma.idempotencyRecord.deleteMany({ where: { blockId } }),
      prisma.block.deleteMany({ where: { id: blockId } }),
    ]);
    res.status(204).end();
  });

  // EVENTS
  app.get("/events", async (req, res) => {
    const blockId = typeof req.query.blockId === "string" ? req.query.blockId : undefined;
    res.json({ events: await listEvents(prisma, userOf(req), blockId) });
  });

  app.post("/events", async (req, res) => {
    const parsedKey = idempotencyKeySchema.safeParse(req.header("idempotency-key") ?? "");
    if (!parsedKey.success) {
      throw new HttpError(400, "missing_idempotency_key", "the Idempotency-Key header is required");
    }
    const { events } = appendRequestSchema.parse(req.body);
    const result = await appendEvents(prisma, config, {
      userId: userOf(req),
      idempotencyKey: parsedKey.data,
      events,
    });
    res
      .status(result.replayed ? 200 : 201)
      .set("Idempotent-Replayed", String(result.replayed))
      .json({ events: result.events });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "not found", code: "not_found" });
  });
  app.use(errorHandler);

  return app;
}
