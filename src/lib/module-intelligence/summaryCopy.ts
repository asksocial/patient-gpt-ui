export function moduleExecutiveSummary(moduleId: string, therapeuticArea: string, summary: string): string {
  if (moduleId === "medical_affairs" && /^glp[ _-]?1$/i.test(therapeuticArea)) {
    return "Medical Affairs Intelligence evaluated eligible findings from corpus records for scientific perception, evidence gaps, medical questions, and safety-relevant discussion. Results are evidence-qualified and should be interpreted with the stated coverage limitations.";
  }
  return summary;
}
