-- Columnstore/compression policy on agent_events older than 7 days
-- (SPEC.md section 5). add_columnstore_policy() is the current API — it
-- replaced the deprecated add_compression_policy() in TimescaleDB 2.18.0.
-- segmentby = run_id since most reads scope to a single run.

ALTER TABLE agent_events SET (
  timescaledb.enable_columnstore,
  timescaledb.segmentby = 'run_id',
  timescaledb.orderby = 'ts DESC, seq DESC'
);

CALL add_columnstore_policy('agent_events', after => INTERVAL '7 days');
