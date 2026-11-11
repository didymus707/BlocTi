import "dotenv/config";
import { userInfo } from "node:os";

// Prisma's migration engine needs an explicit user, unlike libpq
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${userInfo().username}@localhost:5432/bloc_ti_test`;

// refuse to wipe anything that is not obviously a test database
export const assertTestDatabase = (url: string) => {
  const name = new URL(url).pathname.slice(1);
  if (!/test/i.test(name)) {
    throw new Error(`refusing to run API tests against "${name}": the name must contain "test"`);
  }
  return name;
};
