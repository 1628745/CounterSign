-- Continuous aggregates (SPEC.md section 5). Created WITH NO DATA to avoid
-- the "watermark in the future" pitfall; db:seed manually refreshes both
-- after loading history.

-- vendor_spend_daily: 1-day buckets per vendor over successful payments
-- (seeded history, or a real devnet payment that actually confirmed).
CREATE MATERIALIZED VIEW IF NOT EXISTS vendor_spend_daily
WITH (timescaledb.continuous) AS
SELECT
  vendor_id,
  time_bucket('1 day', ts) AS bucket,
  sum(amount_micros)       AS total_micros,
  count(*)                 AS payment_count,
  max(amount_micros)       AS max_micros
FROM payments
WHERE vendor_id IS NOT NULL
  AND (mode = 'history' OR tx_status = 'confirmed')
GROUP BY vendor_id, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('vendor_spend_daily',
  start_offset      => INTERVAL '120 days',
  end_offset        => INTERVAL '1 day',
  schedule_interval  => INTERVAL '1 hour',
  if_not_exists      => TRUE
);

-- spend_by_minute: 1-minute buckets by decision, real-time aggregation on
-- (materialized_only = false) so Mission Control's live charts see the
-- current minute immediately, not just after the next refresh.
CREATE MATERIALIZED VIEW IF NOT EXISTS spend_by_minute
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
  decision,
  time_bucket('1 minute', ts) AS bucket,
  sum(amount_micros)          AS total_micros,
  count(*)                    AS payment_count
FROM payments
GROUP BY decision, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('spend_by_minute',
  start_offset      => INTERVAL '1 day',
  end_offset        => INTERVAL '1 minute',
  schedule_interval  => INTERVAL '1 minute',
  if_not_exists      => TRUE
);
