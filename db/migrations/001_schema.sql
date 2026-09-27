-- Countersign schema: regular tables + plain (pre-hypertable) tables.
-- SPEC.md section 5. gen_random_uuid() is built into Postgres core since v13 — no extension needed.

CREATE TABLE IF NOT EXISTS vendors (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  domain               TEXT NOT NULL,
  verified_address     TEXT NOT NULL,
  verified_at          TIMESTAMPTZ NOT NULL,
  verification_method  TEXT NOT NULL
);

-- The agent's poisonable working memory (SPEC.md section 5). Starts equal to
-- vendors.verified_address; update_vendor_payment_details() can drift it.
CREATE TABLE IF NOT EXISTS vendor_notes (
  vendor_id            TEXT PRIMARY KEY REFERENCES vendors(id),
  payout_address       TEXT NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_from_email   TEXT
);

CREATE TABLE IF NOT EXISTS inbox_emails (
  id            TEXT PRIMARY KEY,
  pack          TEXT NOT NULL,
  "position"    INT NOT NULL,
  from_name     TEXT NOT NULL,
  from_address  TEXT NOT NULL,
  subject       TEXT NOT NULL,
  html          TEXT NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode         TEXT NOT NULL CHECK (mode IN ('naive', 'guarded')),
  pack         TEXT NOT NULL,
  model        TEXT NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  summary      TEXT,
  stats        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS approvals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        UUID NOT NULL,
  auth_req_id       TEXT NOT NULL,
  binding_message   TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  next_poll_at      TIMESTAMPTZ NOT NULL,
  interval_s        INT NOT NULL DEFAULT 5,
  resolved_at       TIMESTAMPTZ,
  approver_sub      TEXT NOT NULL,
  token_fingerprint TEXT
);

CREATE TABLE IF NOT EXISTS eval_results (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_group                 TEXT NOT NULL,
  scenario                  TEXT NOT NULL,
  mode                      TEXT NOT NULL,
  model                     TEXT NOT NULL,
  trial                     INT NOT NULL DEFAULT 1,
  expected                  TEXT NOT NULL,
  actual                    TEXT NOT NULL,
  attacker_received_micros  BIGINT NOT NULL DEFAULT 0,
  correct                   BOOLEAN NOT NULL,
  ts                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hypertable-candidate tables (converted in 002_hypertables.sql). Plain
-- CREATE TABLE here since create_hypertable() operates on an existing table.

CREATE TABLE IF NOT EXISTS payments (
  ts               TIMESTAMPTZ NOT NULL,
  payment_id       UUID NOT NULL DEFAULT gen_random_uuid(),
  run_id           UUID,
  mode             TEXT NOT NULL CHECK (mode IN ('history', 'naive', 'guarded')),
  vendor_id        TEXT REFERENCES vendors(id),
  payee_address    TEXT NOT NULL,
  amount_micros    BIGINT NOT NULL,
  invoice_number   TEXT,
  source_email_id  TEXT,
  decision         TEXT NOT NULL CHECK (decision IN (
                     'history', 'naive_paid', 'auto_pay', 'approval_pending',
                     'approved', 'denied', 'expired', 'blocked'
                   )),
  risk_score       INT,
  tx_signature     TEXT,
  tx_status        TEXT NOT NULL DEFAULT 'none' CHECK (tx_status IN ('none', 'submitted', 'confirmed', 'failed'))
);

CREATE TABLE IF NOT EXISTS risk_evaluations (
  ts          TIMESTAMPTZ NOT NULL,
  payment_id  UUID NOT NULL,
  run_id      UUID,
  score       INT NOT NULL,
  decision    TEXT NOT NULL,
  signals     JSONB NOT NULL,
  provenance  JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_detail_changes (
  ts              TIMESTAMPTZ NOT NULL,
  vendor_id       TEXT NOT NULL REFERENCES vendors(id),
  old_address     TEXT,
  new_address     TEXT NOT NULL,
  source_email_id TEXT,
  sender_address  TEXT,
  verified        BOOLEAN NOT NULL DEFAULT false,
  run_id          UUID
);

CREATE TABLE IF NOT EXISTS agent_events (
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id      UUID NOT NULL,
  seq         BIGINT NOT NULL,
  kind        TEXT NOT NULL,
  email_id    TEXT,
  payment_id  UUID,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb
);
