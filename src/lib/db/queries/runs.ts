/**
 * Reads/writes against the runs table (SPEC.md section 5).
 * TODO(tiger data prompt): implement.
 */
export async function createRun(params: { mode: string; pack: string; model: string }): Promise<string> {
  void params;
  throw new Error("TODO: implement createRun — see SPEC.md section 5");
}

export async function finishRun(runId: string, summary: string, stats: Record<string, unknown>): Promise<void> {
  void runId;
  void summary;
  void stats;
  throw new Error("TODO: implement finishRun — see SPEC.md section 5");
}
