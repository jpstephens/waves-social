import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

function getClient() {
  // Neon Marketplace integration may inject the connection string under various
  // prefixed names depending on how the resource was connected to the project.
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.DATABASE_URL_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL_POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set (also tried DATABASE_URL_DATABASE_URL, POSTGRES_URL, DATABASE_URL_POSTGRES_URL)"
    );
  }
  return neon(connectionString);
}

// Lazy: only instantiate on first access so build/typecheck work without env.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!_db) _db = drizzle(getClient(), { schema });
    return Reflect.get(_db, prop);
  },
});

export * from "./schema";
