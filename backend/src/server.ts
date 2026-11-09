import "dotenv/config";
import { createApp } from "./app.js";
import { createPrisma } from "./db.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example)");

const prisma = createPrisma(DATABASE_URL);
const app = createApp(prisma, {
  now: () => new Date(),
  maxClockSkewSec: Number(process.env.MAX_CLOCK_SKEW_SEC ?? 300),
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
