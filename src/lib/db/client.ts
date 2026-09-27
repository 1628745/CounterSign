import postgres from "postgres";

/**
 * Lazily-created Tiger Data (TimescaleDB) client via the `postgres` package.
 * Raw SQL migrations live in db/migrations (SPEC.md section 5).
 *
 * TODO(tiger data prompt): confirm pooling/SSL options against the Tiger
 * Cloud connection string and record them in docs/PROGRESS.md.
 */
let client: ReturnType<typeof postgres> | null = null;

export function getDb(): ReturnType<typeof postgres> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set — see .env.example and SPEC.md section 5");
    }
    client = postgres(url);
  }
  return client;
}
