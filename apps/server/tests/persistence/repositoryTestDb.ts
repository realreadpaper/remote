import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { newDb } from "pg-mem";
import type { Queryable } from "../../src/persistence/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createRepositoryTestDb(): Promise<Queryable> {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  const schema = readFileSync(join(__dirname, "../../src/persistence/schema.sql"), "utf8");

  await pool.query(schema);
  return pool;
}
