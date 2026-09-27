# Countersign — engineering handbook

A payment firewall for AI agents. Full product spec: [SPEC.md](./SPEC.md). Build log and
decisions: [docs/PROGRESS.md](./docs/PROGRESS.md). Read the relevant SPEC section before touching
the area it covers — pointers are below.

## Stack and versions

- Next.js 16.3.6, App Router, TypeScript strict, `src/` dir, Tailwind v4. Auth runs through
  `src/proxy.ts` (Next 16's replacement for `middleware.ts`) — see docs/PROGRESS.md for why.
- Vercel AI SDK `ai@6` + `@ai-sdk/anthropic@2`, `zod@4`. `AGENT_MODEL` default
  `claude-haiku-4-5-20251001`, temperature 0.
- `@auth0/nextjs-auth0@4` (Universal Login + CIBA over REST).
- Tiger Cloud (TimescaleDB) via the `postgres` package (porsager), raw SQL migrations in
  `db/migrations`.
- `@solana/web3.js@1` + `@solana/spl-token`, devnet only, never mainnet.
- `cheerio` (hidden-text/HTML parsing), `fastest-levenshtein` (lookalike domains), `jose` (JWT
  verification), `bs58`, `tsx` + `vitest` for scripts/tests.
- UI component libraries are added in Prompt 7 — don't add them early.

## Commands

```
npm run dev              # Next.js dev server
npm run build / start    # production build / serve
npm run lint             # eslint
npm test                 # vitest run
npm run doctor           # environment/health checks — run this after any env change
npm run auth0:setup      # idempotent Auth0 tenant setup (app, API, CIBA grant, Guardian push)
npm run test:ciba        # sends a real CIBA push to APPROVER_SUB; exit 0/2/3 = approved/denied/expired
npm run db:migrate       # apply db/migrations/*.sql (idempotent, tracked in schema_migrations)
npm run db:seed          # seed vendors + ~90 days history + E1-E8 inbox; refreshes caggs
npm run chain:setup      # idempotent — run 1 generates wallets + waits for faucet funding, run 2 mints
npm run chain:balances   # print SOL + mUSDC for all six demo wallets
npm run demo:reset       # sweep mUSDC to treasury, clear non-history rows, refresh caggs
npm run agent -- --mode naive --pack demo   # colorized trace + summary table; guarded mode throws until Prompt 5
npm run eval              # score both modes against expected outcomes
npm run shots             # capture demo screenshots (UI prompts)
```

## Folder map

```
src/app/                 routes + API routes (App Router)
src/components/          UI components (Prompt 7+)
src/lib/agent/           AP agent — SPEC.md §7. Imports ONLY src/lib/pipeline.
src/lib/pipeline/        submitPayment(intent, mode) — naive -> signer (live), guarded -> gateway (TODO). §3
src/lib/runs/            startRun() — creates a runs row, drives the agent, async-iterator of events. §3,§10
src/lib/countersign/     gateway.ts, policy.ts (pure), signals/*.ts, provenance/hiddenText/
                         lookalike/classifier.ts. §3, §8
src/lib/auth0/           client.ts (Auth0Client), session.ts, ciba.ts. §9
src/proxy.ts             Next 16 proxy — protects every route except /api/health. §9
src/lib/solana/          connection/wallets/signer/balances/memo/explorer.ts.
                         signer.ts is the ONLY place any *_SECRET_KEY is read. §6
src/lib/db/              client.ts, events.ts (append-only, via runs/eventBus), queries/*.ts. §5
db/migrations/           raw SQL, applied in filename order
data/scenarios/          demo.json (and later, Attack Lab packs). §2
data/wallets.json        committed — public keys only, written by chain-setup. §6
scripts/                 doctor, auth0-setup, ciba-test, db-migrate, db-seed, chain-setup,
                         chain-balances, demo-reset, run-agent, eval, shots
docs/PROGRESS.md         checklist + decisions/versions log — update every prompt
tests/                   vitest — agent-isolation, honesty-guard, ciba, policy.test.ts (E1-E8), etc.
```

## Before working on X, read SPEC section Y

- Agent tools/system prompt → §7. Pipeline routing → §3.
- Policy scoring, signals, hard blocks, thresholds → §8. Demo inbox (E1-E8) → §2.
- Tiger Data schema/migrations/seeding → §5. Solana wallets/mint/memo/signer → §6.
- Auth0 login + CIBA flow → §9. Events + API routes → §10. UI views → §11 (Prompt 7+ only).

## Non-negotiables (SPEC.md §14) — do not violate these

1. **Agent isolation**: `src/lib/agent/**` never imports the signer and never reads a
   `*_SECRET_KEY` env var. Enforced by `eslint.config.mjs` (`no-restricted-imports` /
   `no-restricted-syntax`) and `tests/agent-isolation.test.ts` — both must keep passing.
2. `policy.evaluate` is pure and deterministic (no I/O); scenario tests cover E1-E8
   (`tests/policy.test.ts`).
3. **Write-then-show**: persist every `agent_events` row to Tiger Data before emitting it (SSE/UI).
4. Money is `bigint` micro-units everywhere; format as dollars only in the UI layer.
5. **Devnet only** — refuse to run if `SOLANA_RPC_URL` contains "mainnet".
6. Secrets live only in `.env.local` (never `.env`, never committed); mask them in all logs
   (see `mask()` in `scripts/doctor.ts`).
7. **Honest agent**: identical system prompt and tools in naive and guarded mode, no rigging.
8. When unsure of a third-party API (Auth0, AI SDK, Solana, Tiger), read its current docs before
   coding, and record the version/decision in `docs/PROGRESS.md`.
9. Follow the checkpoint protocol below at the end of every prompt.

## Checkpoint protocol

At the end of every prompt: run verifications (lint, `tsc --noEmit`, `npm run doctor`, relevant
tests, `npm run dev` smoke check), update `docs/PROGRESS.md` (checklist + decisions), commit, then
print:

```
CHECKPOINT - Prompt N
Verified: commands run and results
Issues: anything flaky or skipped
Your turn: exact numbered steps for me, or "nothing"
Next: what the next prompt will do
```

## Working style

I (the lead engineer, an AI agent) build; the user directs and only steps in for things that
genuinely need them — browser logins, keys, their phone (e.g. Guardian push approvals). Batch
questions into the checkpoint instead of stopping mid-task.

@AGENTS.md
