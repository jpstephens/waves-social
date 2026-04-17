import type { Config } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const url =
  process.env.DATABASE_URL ??
  process.env.DATABASE_URL_DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL_POSTGRES_URL;

if (!url) {
  throw new Error("No database connection string found in env");
}

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
} satisfies Config;
