import { loadCanonicalFindingsForAsk } from "./loadCanonicalFindingsForAsk";
import { loadSearchCorpusIntelligence } from "./loadSearchCorpusIntelligence";
import type { PersonaIntelligenceSummary } from "../../answering/personas/buildPersonaIntelligence";

/** Legacy full-corpus views share the current Search labels and source counts. */
export function loadGlp1PersonaIntelligence(): PersonaIntelligenceSummary {
  return loadSearchCorpusIntelligence("GLP-1", loadCanonicalFindingsForAsk("GLP-1").findings);
}
