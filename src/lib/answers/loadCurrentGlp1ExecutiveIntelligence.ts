import { enrichFindingsWithEvidenceIntelligence } from "../../answering/evidence";
import { assignThemesToFindings } from "../../answering/themes/assignThemes";
import { aggregateThemes } from "../../answering/themes/aggregateThemes";
import { detectThemeRelationships } from "../../answering/themes/detectThemeRelationships";
import { buildThemeStrategicImplications } from "../../answering/themes/buildThemeStrategicImplications";
import { buildThemeLongitudinalTracking } from "../../answering/themes/buildThemeLongitudinalTracking";
import { buildThemeKnowledgeSnapshot } from "../../answering/knowledge";
import { buildExecutiveIntelligenceBrief } from "../../answering/executive";
import { getCanonicalCorpusRevision, loadCanonicalFindingsForAsk } from "./loadCanonicalFindingsForAsk";
import { loadGlp1PersonaIntelligence } from "./loadGlp1PersonaIntelligence";

const cache = new Map<string, ReturnType<typeof buildCurrentGlp1ExecutiveIntelligence>>();

/** Rebuild derived presentation from current evidence; never rewrite saved evidence. */
export function loadCurrentGlp1ExecutiveIntelligence(therapeuticArea: string, _question = "") {
  if (!/^glp[\s_-]?1$/i.test(therapeuticArea || "")) return null;
  const key = getCanonicalCorpusRevision(therapeuticArea);
  if (cache.has(key)) return structuredClone(cache.get(key)!);
  const current = buildCurrentGlp1ExecutiveIntelligence();
  if (current) {
    if (cache.size >= 16) cache.delete(cache.keys().next().value!);
    cache.set(key, current);
  }
  return structuredClone(current);
}

function buildCurrentGlp1ExecutiveIntelligence() {
  const corpus = loadCanonicalFindingsForAsk("GLP-1");
  if (corpus.status !== "available") return null;
  const findings = assignThemesToFindings(enrichFindingsWithEvidenceIntelligence(corpus.findings), "GLP-1");
  const themeSummary = aggregateThemes(findings, "GLP-1");
  const themeRelationships = detectThemeRelationships(findings, themeSummary, "GLP-1");
  const themeStrategicImplications = buildThemeStrategicImplications(themeSummary, themeRelationships);
  const themeLongitudinalTracking = buildThemeLongitudinalTracking(findings, themeSummary);
  const knowledgeSnapshot = buildThemeKnowledgeSnapshot({ therapeuticArea: "GLP-1", themes: themeSummary, relationships: themeRelationships, strategicImplications: themeStrategicImplications, longitudinalTracking: themeLongitudinalTracking, sourceQuery: "Full GLP-1 corpus executive overview" });
  const executiveIntelligence = buildExecutiveIntelligenceBrief({ snapshot: knowledgeSnapshot });
  const composition = loadGlp1PersonaIntelligence();
  executiveIntelligence.dataQuality.corpusScope = "full_corpus";
  executiveIntelligence.dataQuality.sourceRecordCount = composition.denominator;
  executiveIntelligence.dataQuality.excludedRecordCount = composition.denominator - corpus.findings.length;
  executiveIntelligence.dataQuality.warnings.push(
    `Current GLP-1 corpus: ${composition.denominator.toLocaleString("en-US")} source records; ${composition.analyticalCount?.toLocaleString("en-US")} analytical findings. Audience labels are machine-derived; records are not unique patients or safety cases.`,
    "Multilingual audience classification does not establish validated multilingual PV screening. Review Queue and Health Experience Detection use the approved English PV library and separate source eligibility rules.",
  );
  return { knowledgeSnapshot, executiveIntelligence, themeSummary, themeRelationships, themeStrategicImplications, themeLongitudinalTracking };
}
