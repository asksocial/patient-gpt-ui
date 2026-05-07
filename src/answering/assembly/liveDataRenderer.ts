export function renderLiveDataStatus(liveFindingsCount: number): string {
  if (liveFindingsCount === 0) {
    return "No live themes were retrieved for this response, so the answer reflects curated intelligence only.";
  }
  return "Live social signals were retrieved and used to validate or extend the curated intelligence.";
}