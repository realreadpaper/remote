import { Pool } from "pg";

export interface QueryResult<T> {
  rows: T[];
}

export interface Queryable {
  query<T = unknown>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}

export function createPostgresPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}
