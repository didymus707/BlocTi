import { execSync } from "node:child_process";
import pg from "pg";
import { assertTestDatabase, TEST_DATABASE_URL } from "./testDb.js";

// create the test database if needed and bring it to the latest migration
export default async function setup() {
  const name = assertTestDatabase(TEST_DATABASE_URL);
  const admin = new URL(TEST_DATABASE_URL);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (!exists.rowCount) await client.query(`CREATE DATABASE "${name}"`);
  await client.end();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}
