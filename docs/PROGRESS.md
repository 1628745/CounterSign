# Countersign — build progress

Proposed 9-prompt roadmap (inferred from SPEC.md's structure; adjust as needed — flagged at the
Prompt 1 checkpoint). Each prompt ends with the checkpoint protocol in SPEC.md §14/CLAUDE.md.

## Checklist

- [x] **Prompt 1 — Scaffold.** Repo init, Next.js 16 (App Router/TS strict/`src/`/Tailwind/ESLint),
      core deps installed, `src/lib/*` folder structure with typed placeholder modules,
      `package.json` script stubs, `.env.example`/`.env.local`, `scripts/doctor.ts`, Auth0 CLI
      tooling check, minimal home page, `CLAUDE.md`, this file.
- [ ] **Prompt 2 — Tiger Data.** Raw SQL migrations for the full schema (SPEC.md §5): vendors,
      vendor_notes, inbox_emails, runs, approvals, eval_results, and the payments/
      risk_evaluations/vendor_detail_changes/agent_events hypertables, plus the
      vendor_spend_daily/spend_by_minute continuous aggregates, compression policy, and indexes.
      `db:migrate` + `db:seed` (≈90 days vendor history incl. INV-BR-4388 paid 6 days ago).
      `db/client.ts`, `db/events.ts`, `db/queries/*.ts` implemented. Doctor's Tiger Data check
      goes from SKIP to a real `select 1`.
- [ ] **Prompt 3 — Solana (devnet).** `chain-setup.ts` (treasury/vendor/attacker wallets, mUSDC
      mint, ATAs), `data/wallets.json` populated, `src/lib/solana/*` implemented
      (connection/wallets/signer/balances/memo/explorer), `chain-balances.ts`, `demo-reset.ts`.
      Doctor's Solana check goes from SKIP to real devnet connectivity + balance checks.
- [ ] **Prompt 4 — Countersign policy engine.** `hiddenText.ts`/`lookalike.ts`/`classifier.ts`
      detectors, all 12 `signals/*.ts`, `provenance.ts`, `policy.evaluate` (pure), and the E1-E8
      realistic-HTML demo inbox in `data/scenarios/demo.json`. `tests/policy.test.ts` scenarios
      filled in and passing (SPEC.md §2, §8).
- [ ] **Prompt 5 — Agent, pipeline, gateway, Auth0 CIBA.** `agent/tools.ts` + `agent/index.ts`
      (SPEC.md §7), `pipeline.submitPayment`, `gateway.submitToGateway` orchestration, Auth0
      Universal Login session helpers + `ciba.ts` (initiate/poll/verify), `/api/approvals/poll`.
      `run-agent.ts` script functional for both naive and guarded modes.
- [ ] **Prompt 6 — UI foundations.** Add UI libraries (deferred until now on purpose). Mission
      Control layout: inbox, live agent timeline with decision cards, money/approvals panel.
      `/api/runs` SSE streaming.
- [ ] **Prompt 7 — UI completion.** Attack Lab, Ledger, Under the Hood views; `/api/payments/[id]`,
      `/api/ledger`, `/api/wallets`, `/api/lab/emails`, `/api/demo/reset` (SPEC.md §10-11).
- [ ] **Prompt 8 — Eval harness + Attack Lab.** `eval.ts` scoring both modes against expected
      outcomes into `eval_results`; additional attack-pack scenarios beyond the demo inbox.
- [ ] **Prompt 9 — Polish + demo rehearsal.** `shots.ts` screenshots, end-to-end naive-vs-guarded
      demo run, README/demo script polish, final checkpoint.

## Decisions and versions

- **Next.js 16.3.6** (App Router, TS strict, `src/`). Chosen because `@auth0/nextjs-auth0@4.30.0`
  (the newest v4 release as of 2026-09-27) declares
  `peerDependencies.next: "^14.2.35 || ~15.0.7 || ... || ~15.5.9 || ^16.0.10"` — i.e. the newest
  Next.js it officially supports is the `^16.0.10` range, and `npm view next dist-tags.latest`
  resolves to `16.3.6`, which satisfies that range. Read straight from
  `github.com/auth0/nextjs-auth0` main README.
- **Auth routing: `proxy.ts`, not `middleware.ts`.** The auth0/nextjs-auth0 README states Next.js
  16 introduces `proxy.ts` as the replacement for `middleware.ts` ("this change better represents
  the network interception boundary..."), and that `middleware.ts` is deprecated for the Node
  runtime on Next 16+ (still functional under the Edge runtime, for backward compat only). Since
  we're on Next 16.3.6, new auth wiring (Prompt 5) will use `proxy.ts`. Not implemented yet in
  Prompt 1 — this is a recorded decision for the Auth0 prompt to act on.
- **`ai@6.0.293` + `@ai-sdk/anthropic@2.0.106` + `zod@4.6.5`.** `ai@6`'s current major pairs with
  `@ai-sdk/anthropic@2` (both declare `zod: "^3.25.76 || ^4.1.8"` as a peer); picked latest patches
  of each as of 2026-09-27.
- **`@solana/web3.js@1.99.0`** (latest 1.x — SPEC.md §4/§6 call for v1, not the newer 2.x line) +
  **`@solana/spl-token@0.4.15`**.
- **`vitest@4.1.11`, not the `5.x` latest.** `vitest@5` requires Node `^22.12.0 || ^24.0.0 ||
  >=26.0.0`; this machine runs Node v20.18.3. `vitest@4` accepts `^20.0.0`, so we pinned there to
  avoid forcing a Node upgrade mid-hackathon. Revisit if the dev machine moves to Node 22/24.
- **Known, accepted flakiness:** `npm install` prints an `EBADENGINE` warning for
  `eslint-visitor-keys@5.0.1` (wants Node `^20.19.0 || ^22.13.0 || >=24`; we have `20.18.3`) — a
  transitive dep of `eslint@9` pulled in by `create-next-app`. It's a warning, not a failure;
  `npm run lint` was verified to still work (see Prompt 1 checkpoint). `npm install` also reports
  a handful of moderate/high `npm audit` advisories, mostly from `@solana/web3.js@1.x`'s older
  transitive deps (a known, long-standing situation for that package's 1.x line). Not fixed with
  `npm audit fix --force` because that would silently swap pinned majors; revisit if time allows.
- **Tiger Cloud service already provisioned**: `tiger service_list` (MCP) shows one DEV
  TimescaleDB service (`db-90364`, `us-east-1`, READY) already exists in this environment. Prompt 2
  will fetch its connection string for `DATABASE_URL` rather than provisioning a new one.
- **Auth0 CLI**: installed via `brew install auth0` (v1.36.0) during Prompt 1. Not yet logged in —
  `auth0 login` needs an interactive browser step, so that's a "your turn" item for Prompt 5, not
  something done unattended.
- **Two small config fixes made during verification**, both cosmetic/non-functional:
  `vitest.config.ts` → `vitest.config.mts` (Vite's config loader tried to `require()` an ESM
  transitive dep and failed under the plain `.ts` extension since this package isn't
  `"type": "module"`; the `.mts` extension makes the ESM-ness unambiguous). `next.config.ts` now
  sets `turbopack.root` to silence a Turbopack root-detection warning caused by an unrelated
  `package-lock.json` sitting in the parent home directory (not part of this repo).
