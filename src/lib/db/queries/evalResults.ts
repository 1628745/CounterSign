/**
 * Reads/writes against eval_results, backing `npm run eval` (SPEC.md
 * section 5 and 12).
 * TODO(eval prompt): implement.
 */
export async function recordEvalResult(result: Record<string, unknown>): Promise<void> {
  void result;
  throw new Error("TODO: implement recordEvalResult — see SPEC.md section 5");
}
