# Countersign — build progress

Proposed 9-prompt roadmap (inferred from SPEC.md's structure; adjust as needed — flagged at the
Prompt 1 checkpoint). Each prompt ends with the checkpoint protocol in SPEC.md §14/CLAUDE.md.

## Checklist

- [x] **Prompt 1 — Scaffold.** Repo init, Next.js 16 (App Router/TS strict/`src/`/Tailwind/ESLint),
      core deps installed, `src/lib/*` folder structure with typed placeholder modules,
      `package.json` script stubs, `.env.example`/`.env.local`, `scripts/doctor.ts`, Auth0 CLI
      tooling check, minimal home page, `CLAUDE.md`, this file.
- [x] **Prompt 2 — Auth0 login + CIBA go/no-go.** Reordered ahead of Tiger Data/Solana at the
      user's direction, since it's the project's biggest platform-risk item. `scripts/auth0-setup.ts`
      (Regular Web App with the CIBA grant + guardian-push channel, the `payments:approve` API,
      MFA push factor — all idempotent/re-runnable), `src/proxy.ts` + `src/lib/auth0/client.ts`
      (Universal Login, every route protected except `/api/health`), `src/lib/auth0/ciba.ts`
      (initiate/poll/verify per SPEC.md §9), `scripts/ciba-test.ts`, Auth0 doctor checks. **Real
      end-to-end CIBA push round-trip verified on the approver's phone — see Decisions below.**
- [ ] **Prompt 3 — Tiger Data.** Raw SQL migrations for the full schema (SPEC.md §5): vendors,
      vendor_notes, inbox_emails, runs, approvals, eval_results, and the payments/
      risk_evaluations/vendor_detail_changes/agent_events hypertables, plus the
      vendor_spend_daily/spend_by_minute continuous aggregates, compression policy, and indexes.
      `db:migrate` + `db:seed` (≈90 days vendor history incl. INV-BR-4388 paid 6 days ago).
      `db/client.ts`, `db/events.ts`, `db/queries/*.ts` implemented. Doctor's Tiger Data check
      goes from SKIP to a real `select 1`.
- [ ] **Prompt 4 — Solana (devnet).** `chain-setup.ts` (treasury/vendor/attacker wallets, mUSDC
      mint, ATAs), `data/wallets.json` populated, `src/lib/solana/*` implemented
      (connection/wallets/signer/balances/memo/explorer), `chain-balances.ts`, `demo-reset.ts`.
      Doctor's Solana check goes from SKIP to real devnet connectivity + balance checks.
- [ ] **Prompt 5 — Countersign policy engine.** `hiddenText.ts`/`lookalike.ts`/`classifier.ts`
      detectors, all 12 `signals/*.ts`, `provenance.ts`, `policy.evaluate` (pure), and the E1-E8
      realistic-HTML demo inbox in `data/scenarios/demo.json`. `tests/policy.test.ts` scenarios
      filled in and passing (SPEC.md §2, §8).
- [ ] **Prompt 6 — Agent, pipeline, gateway.** `agent/tools.ts` + `agent/index.ts` (SPEC.md §7),
      `pipeline.submitPayment`, `gateway.submitToGateway` orchestration wired to policy + Tiger
      Data + the signer + the already-built `ciba.ts`, `/api/approvals/poll`. `run-agent.ts`
      functional for both naive and guarded modes.
- [ ] **Prompt 7 — UI foundations.** Add UI libraries (deferred until now on purpose). Mission
      Control layout: inbox, live agent timeline with decision cards, money/approvals panel.
      `/api/runs` SSE streaming.
- [ ] **Prompt 8 — UI completion.** Attack Lab, Ledger, Under the Hood views; `/api/payments/[id]`,
      `/api/ledger`, `/api/wallets`, `/api/lab/emails`, `/api/demo/reset` (SPEC.md §10-11).
- [ ] **Prompt 9 — Eval harness + polish.** `eval.ts` scoring both modes against expected outcomes
      into `eval_results`, additional Attack Lab scenarios, `shots.ts` screenshots, end-to-end
      naive-vs-guarded demo rehearsal, final checkpoint.

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
  runtime on Next 16+ (still functional under the Edge runtime, for backward compat only).
  Confirmed against Next.js's own `proxy.js` file-convention doc (v16.3.6): the file lives at
  `src/proxy.ts` (same level as `app/`), exports a `proxy` function (default or named), and an
  optional `config.matcher`. Implemented in Prompt 2 as `src/proxy.ts`, calling
  `auth0.middleware(request)` from `src/lib/auth0/client.ts`, then redirecting to `/auth/login` for
  any request without a session except `/api/health` (excluded from the matcher entirely) and the
  SDK's own `/auth/*` routes.
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
  TimescaleDB service (`db-90364`, `us-east-1`, READY) already exists in this environment. Prompt 3
  will fetch its connection string for `DATABASE_URL` rather than provisioning a new one.
- **Two small config fixes made during Prompt 1 verification**, both cosmetic/non-functional:
  `vitest.config.ts` → `vitest.config.mts` (Vite's config loader tried to `require()` an ESM
  transitive dep and failed under the plain `.ts` extension since this package isn't
  `"type": "module"`; the `.mts` extension makes the ESM-ness unambiguous). `next.config.ts` now
  sets `turbopack.root` to silence a Turbopack root-detection warning caused by an unrelated
  `package-lock.json` sitting in the parent home directory (not part of this repo).

### Prompt 2 — Auth0 login + CIBA

- **CIBA implementation: plain REST, not `@auth0/ai-vercel`'s `withAsyncAuthorization`.** SPEC.md
  §9 explicitly makes this our call ("use `withAsyncAuthorization` only if it fits this
  non-blocking, gateway-decided design; otherwise use the REST calls above"). `withAsyncAuthorization`
  is built to wrap a single tool call and suspend/resume *within that call's lifecycle* — it assumes
  the caller wants to block (or checkpoint/replay) around one specific agent tool invocation. Our
  design is the opposite: the **gateway**, not the agent, decides when approval is needed
  (non-negotiable), `gateway.submitToGateway` must return immediately with `approval_pending`, and
  a separate `POST /api/approvals/poll` advances *any* due approval later, decoupled from the
  request that created it. That's a stored-row-plus-poller model, not a call-scoped
  suspend/resume model, so the library's abstraction would fight the architecture rather than help.
  Plain REST (`bc-authorize` + polled `/oauth/token`) also keeps `mapPollResponse` a pure,
  dependency-free function that's trivial to unit test (`tests/ciba.test.ts`) — no framework
  request/response objects involved. Implemented in `src/lib/auth0/ciba.ts`.
- **Auth0 tenant setup is scripted and idempotent**: `scripts/auth0-setup.ts` shells out to the
  `auth0` CLI (assumes `auth0 login` already ran) for everything it has a dedicated command for,
  and to `auth0 api` for the rest (`guardian/factors/push-notification`, patching
  `async_approval_notification_channels` and `grant_types` on the client — neither is exposed by
  `auth0 apps create`'s flags, confirmed via `auth0 apps create --schema`). Re-running it is a
  no-op when nothing needs to change; it never prints secret values, only what it changed. Created:
  Regular Web App "Countersign" (grant_types include `urn:openid:params:grant-type:ciba`,
  `async_approval_notification_channels: ["guardian-push"]`, callback `/auth/callback` matching the
  SDK's default route), API `https://countersign.demo/api` with scope `payments:approve`, tenant
  MFA push (Guardian) factor enabled. **No subscription-upgrade error was hit** — this tenant's
  plan supports CIBA + Guardian push directly, so the tenant-recreation fallback in SPEC.md §9
  step 1 wasn't needed.
- **Guardian enrollment gotcha — the real failure mode of this checkpoint.** The first enrollment
  ticket left the Guardian record at `status: "pending"` (device registered, but not confirmed);
  `bc-authorize` then failed outright with *"No eligible notification channels were found.
  guardian-push: User does not have push notifications set up"* — i.e. a `pending` enrollment is
  not eligible for CIBA push at all, it must be `confirmed`. Root cause looked like the enrollment
  link being opened in a way that didn't fully hand off to the Guardian app (e.g. notification
  permission not yet granted). Fix: re-issued a fresh enrollment ticket, had the approver confirm
  iOS notification permissions for Guardian were on, and re-completed enrollment — the record
  flipped to `status: "confirmed"` and CIBA push worked immediately after. **Doctor's Guardian
  check (`checkApproverGuardianEnrollment`) checks specifically for a `confirmed` enrollment**, not
  just "an enrollment exists," because of this.
- **GO/NO-GO: we are on the CIBA/Guardian-push path, not the QR-fallback path.** `npm run
  test:ciba` was run twice against a real phone: once approved (exit 0, JWT verified against the
  tenant JWKS, `scope` included `payments:approve`, `sub` matched `APPROVER_SUB`) and once denied
  (exit 2). Both round-trips completed within seconds of the push arriving. The `/approve/[id]`
  QR/`max_age=0` fallback described in SPEC.md's go/no-go was **not built** — it wasn't needed.
- **Doctor additions**: Auth0 domain reachability (`/.well-known/openid-configuration`), client
  credential validity (a `client_credentials` probe against the Management API audience — Auth0
  rejects bad credentials with `401 Unauthorized` *before* it checks grants, so a `403 ... you need
  a client-grant` response actually confirms the credentials are correct), CIBA grant +
  guardian-push channel on the client, tenant Guardian push factor, and approver Guardian
  enrollment status — the last two shell out to the `auth0` CLI and SKIP (not FAIL) if it's
  unavailable/logged out, since that's a local tooling gap, not a Countersign config problem.
