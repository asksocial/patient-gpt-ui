import { moduleNarrative, patientNarrative } from "../../answering/narrative/intelligenceNarratives";
import type { ModuleIntelligenceResult } from "./buildModuleIntelligence";
import type { PatientIntelligenceResult } from "../patient-intelligence/buildPatientIntelligence";

/** Refresh presentation from a saved report's own evidence, without rewriting it. */
export function moduleExecutiveSummary(summary: string, result?: ModuleIntelligenceResult | PatientIntelligenceResult): string {
  if (result && "moduleId" in result) return moduleNarrative(result);
  if (result && "treatmentBarriers" in result) return patientNarrative(result);
  return summary
    .replace(/evaluated [\d,]+ eligible findings from [\d,]+ corpus records/, "evaluated eligible findings from corpus records")
    .replace(/Patient Intelligence analyzed [\d,]+ /, "Patient Intelligence analyzed ")
    .replace(/ from [\d,]+ corpus findings\./, " from corpus findings.");
}
