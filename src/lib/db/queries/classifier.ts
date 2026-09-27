import { getDb } from "../client";

export interface ClassificationRow {
  fraudLikelihood: number;
  cues: string[];
  model: string;
  classifiedAt: Date;
}

/** Reads/writes the classifier_flag signal's per-email cache (SPEC.md section 8). */
export async function getCachedClassification(emailId: string): Promise<ClassificationRow | null> {
  const sql = getDb();
  const rows = await sql<{ fraud_likelihood: number; cues: string[]; model: string; classified_at: Date }[]>`
    SELECT fraud_likelihood, cues, model, classified_at FROM email_classifications WHERE email_id = ${emailId}
  `;
  if (!rows[0]) return null;
  return {
    fraudLikelihood: rows[0].fraud_likelihood,
    cues: rows[0].cues,
    model: rows[0].model,
    classifiedAt: rows[0].classified_at,
  };
}

export async function setCachedClassification(
  emailId: string,
  result: { fraudLikelihood: number; cues: string[]; model: string },
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO email_classifications (email_id, fraud_likelihood, cues, model)
    VALUES (${emailId}, ${result.fraudLikelihood}, ${sql.json(JSON.parse(JSON.stringify(result.cues)))}, ${result.model})
    ON CONFLICT (email_id) DO UPDATE SET
      fraud_likelihood = EXCLUDED.fraud_likelihood,
      cues = EXCLUDED.cues,
      model = EXCLUDED.model,
      classified_at = now()
  `;
}
