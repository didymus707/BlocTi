import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma 7 talks to Postgres through a driver adapter
export const createPrisma = (connectionString: string) =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
