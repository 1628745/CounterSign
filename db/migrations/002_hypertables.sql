-- Convert to hypertables (time column ts) and add the indexes from SPEC.md
-- section 5. Current TimescaleDB interface: create_hypertable(table, by_range(column)).

SELECT create_hypertable('payments', by_range('ts'), if_not_exists => TRUE);
SELECT create_hypertable('risk_evaluations', by_range('ts'), if_not_exists => TRUE);
SELECT create_hypertable('vendor_detail_changes', by_range('ts'), if_not_exists => TRUE);
SELECT create_hypertable('agent_events', by_range('ts'), if_not_exists => TRUE);

-- payments: required indexes (SPEC.md section 5) plus lookup/uniqueness support.
-- Unique indexes on a hypertable must include the partitioning column (ts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment_id_ts ON payments (payment_id, ts);
CREATE INDEX IF NOT EXISTS idx_payments_payee_address ON payments (payee_address, ts DESC);
CREATE INDEX IF NOT EXISTS idx_payments_vendor_invoice ON payments (vendor_id, invoice_number, ts DESC);
-- Supports vendorMedian90d / vendorMaxDaily90d / vendorSpendToday / hasSuccessfulPaymentTo.
CREATE INDEX IF NOT EXISTS idx_payments_vendor_ts ON payments (vendor_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_risk_evaluations_payment_id ON risk_evaluations (payment_id, ts DESC);

-- Supports recentUnverifiedChange.
CREATE INDEX IF NOT EXISTS idx_vendor_detail_changes_vendor_ts ON vendor_detail_changes (vendor_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_detail_changes_new_address ON vendor_detail_changes (new_address, ts DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_events_run_seq ON agent_events (run_id, seq, ts);
CREATE INDEX IF NOT EXISTS idx_agent_events_run_ts ON agent_events (run_id, ts);
