#!/usr/bin/env tsx
// npm run db:migrate — applies db/migrations/*.sql in filename order against
// DATABASE_URL, recording which files ran in a schema_migrations table so
// reruns are no-ops. See SPEC.md section 5.

import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "db", "migrations");

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set — see .env.example (SPEC.md section 13)");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const appliedRows = await sql<{ filename: string }[]>`SELECT filename FROM schema_migrations`;
    const applied = new Set(appliedRows.map((r) => r.filename));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log(`No .sql files found in ${MIGRATIONS_DIR}`);
      return;
    }

    let ranCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`SKIP  ${file} (already applied)`);
        continue;
      }
      console.log(`RUN   ${file}`);
      const text = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      await sql.unsafe(text);
      await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`;
      console.log(`OK    ${file}`);
      ranCount += 1;
    }

    console.log(ranCount === 0 ? "Already up to date." : `Applied ${ranCount} migration(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("db:migrate failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
