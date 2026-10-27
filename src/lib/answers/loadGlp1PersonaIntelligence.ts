import { getCanonicalCorpusRevision } from "./loadCanonicalFindingsForAsk";
import { buildCorpusCharts } from "../../answering/personas/buildCorpusCharts";
import path from "node:path";
import { parseMeltwaterCsv, adaptMeltwaterRows } from "../../ingestion/adapters/meltwaterAdapter";
import { glp1Profile } from "../../ingestion/profiles/glp1Profile";
import { classifyGlp1Audience } from "../../ingestion/glp1Audience";
import { buildPersonaIntelligence, type PersonaIntelligenceSummary } from "../../answering/personas/buildPersonaIntelligence";

let cached: { revision: string; summary: PersonaIntelligenceSummary } | undefined;

/** Composition includes every source row, including records excluded from
 * thematic analytics. It is independent of query intent, mode and ranking. */
export function loadGlp1PersonaIntelligence(): PersonaIntelligenceSummary {
  const revision = getCanonicalCorpusRevision("GLP-1");
  if (cached?.revision !== revision) {
    const rows = parseMeltwaterCsv(path.resolve(process.cwd(), "data/glp-1.csv"));
    const analytical = adaptMeltwaterRows(rows, { sourceType: "meltwater", profile: glp1Profile });
    const analyticalCount = analytical.length;
    const summary = buildPersonaIntelligence(rows.map((fields, index) => ({
      findingId: `glp1-source-row-${index + 2}`,
      audienceClassification: classifyGlp1Audience(fields),
      rawMetadata: { fields },
    })), { scope: "full_corpus", analyticalCount });
    summary.corpusCharts = buildCorpusCharts(analytical);
    cached = { revision, summary };
  }
  return structuredClone(cached!.summary);
}
