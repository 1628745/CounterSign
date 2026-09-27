-- Cache for the quarantined classifier signal (SPEC.md section 8:
-- "classifier_flag +10: ... cached per email"). Not in SPEC section 5's
-- table list since it's an implementation detail of the classifier_flag
-- signal, not part of the core data model.

CREATE TABLE IF NOT EXISTS email_classifications (
  email_id         TEXT PRIMARY KEY REFERENCES inbox_emails(id),
  fraud_likelihood REAL NOT NULL CHECK (fraud_likelihood >= 0 AND fraud_likelihood <= 1),
  cues             JSONB NOT NULL,
  model            TEXT NOT NULL,
  classified_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
