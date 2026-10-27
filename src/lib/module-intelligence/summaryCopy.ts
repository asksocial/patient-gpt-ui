export function moduleExecutiveSummary(summary: string): string {
  return summary
    .replace(/evaluated [\d,]+ eligible findings from [\d,]+ corpus records/, "evaluated eligible findings from corpus records")
    .replace(/Patient Intelligence analyzed [\d,]+ /, "Patient Intelligence analyzed ")
    .replace(/ from [\d,]+ corpus findings\./, " from corpus findings.");
}
