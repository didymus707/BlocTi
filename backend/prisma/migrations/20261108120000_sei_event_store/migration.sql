-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "plannedDuration" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tasks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'dev-user';

-- CreateTable
CREATE TABLE "Event" (
    "eventId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Event_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "eventIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Event_userId_blockId_seq_idx" ON "Event"("userId", "blockId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Event_blockId_seq_key" ON "Event"("blockId", "seq");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_blockId_idx" ON "IdempotencyRecord"("blockId");

-- CreateIndex
CREATE INDEX "Block_userId_idx" ON "Block"("userId");


-- Events are append-only: a trace can be deleted with its block, never edited.
CREATE FUNCTION "sei_reject_event_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SEI events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "sei_events_append_only"
BEFORE UPDATE ON "Event"
FOR EACH ROW EXECUTE FUNCTION "sei_reject_event_update"();
