import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseMeltwaterCsv } from "../ingestion/adapters/meltwaterAdapter";
import { loadCanonicalFindingsForModule } from "../lib/answers/loadCanonicalFindingsForAsk";
import { buildModuleEvidenceCatalog, buildModuleIntelligence } from "../lib/module-intelligence/buildModuleIntelligence";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const corpusPath = path.resolve(process.cwd(), "data/botulinum-toxin-clinical-trials.csv");
const corpusBytes = fs.readFileSync(corpusPath);
const checksum = crypto.createHash("sha256").update(corpusBytes).digest("hex");
assert(checksum === "0dc17b1445150f2ecd7ed0a1126329d3dd6fc6903ea24b1a8d8790e5be36c4cd", "The source Clinical Trials corpus must remain byte-for-byte reproducible.");

const sourceRows = parseMeltwaterCsv(corpusPath);
assert(sourceRows.length === 4_902, "The Clinical Trials Meltwater export row count changed unexpectedly.");
assert(sourceRows.filter((row) => row.Source === "ClinicalTrials.gov").length === 51, "The source corpus must retain its ClinicalTrials.gov records.");
assert(sourceRows.every((row) => row["Input Name"] === "Botulinum Toxin Clinical Trials"), "Every source row must retain the dedicated Meltwater input name.");

const corpus = loadCanonicalFindingsForModule("Botulinum toxin", "clinical_trials");
assert(corpus.status === "available", "The dedicated Botulinum toxin Clinical Trials corpus must load.");
assert(corpus.sourceLabel === "Botulinum toxin Clinical Trials Meltwater corpus", "The module corpus must expose explicit provenance.");
assert(corpus.relevancePolicy === "prequalified", "The dedicated Meltwater export must be treated as pre-qualified for relevance.");
assert(corpus.findings.length === 4_850, "Every source row with analyzable mention text must remain in the pre-qualified corpus.");
assert(sourceRows.length - corpus.findings.length === 52, "Only source rows without usable mention text may remain unavailable for analysis.");
assert(corpus.findings.every((finding) => finding.therapeuticArea === "Botulinum toxin"), "Every finding must remain scoped to Botulinum toxin.");

const intelligence = buildModuleIntelligence("clinical_trials", "Botulinum toxin", corpus.findings, "2026-08-15T16:00:00.000Z", { relevancePolicy: corpus.relevancePolicy });
assert(intelligence.dataQuality.corpusFindingCount === corpus.findings.length, "Clinical Trials must analyze the complete dedicated canonical corpus.");
assert(intelligence.dataQuality.relevancePolicy === "prequalified", "The module output must disclose its pre-qualified relevance policy.");
assert(intelligence.dataQuality.eligibleFindingCount === corpus.findings.length && intelligence.dataQuality.selectedFindingCount === corpus.findings.length, "Evidence quality must label and rank—not discard—pre-qualified mentions.");
assert(intelligence.dataQuality.unclassifiedFindingCount <= 1, "Clinical Trials metadata fallbacks must resolve nearly every unknown evidence class without discarding records.");
assert(intelligence.dataQuality.unspecifiedAudienceFindingCount <= 1, "Clinical Trials metadata fallbacks must resolve nearly every unspecified audience without discarding records.");
assert(!intelligence.sourceSignals.some((item) => item.label === "unknown"), "Evidence Classes must not present unknown when source metadata supports a specific class.");
assert(!intelligence.audienceSignals.some((item) => item.label === "unspecified_audience"), "Audience Coverage must not present unspecified audience when evidence metadata supports a specific audience.");
assert(intelligence.dataQuality.assessment === "adequate" && intelligence.dataQuality.contextualEvidenceFindingCount >= 4_000, "The expanded taxonomy must contextually classify the substantive majority of the corpus.");
assert(intelligence.sections.length === 9, "The Clinical Trials taxonomy must cover nine decision-relevant dimensions.");
assert(intelligence.sections.every((section) => section.findingCount > 0), "Recruitment, retention, protocol, and site-experience analyses must all receive evidence.");
assert(intelligence.evidence.length === 16, "The Clinical Trials output must retain a full, deduplicated evidence set.");
assert(intelligence.evidence.filter((item) => item.evidenceClass === "clinical_study").length >= 5, "Direct clinical-study evidence must materially support the output.");
assert(intelligence.evidence.every((item) => item.url?.startsWith("http")), "Every Clinical Trials evidence card must retain an actionable original-source URL.");
assert(intelligence.evidence.every((item) => item.qualityBand && Number.isFinite(item.qualityScore)), "Representative evidence must expose quality labels and scores.");
assert(new Set(intelligence.evidence.map((item) => item.findingId)).size === intelligence.evidence.length, "A mention must not appear more than once in Clinical Trials module evidence.");

const firstPage = buildModuleEvidenceCatalog("clinical_trials", "Botulinum toxin", corpus.findings, { page: 1, pageSize: 12 }, { relevancePolicy: corpus.relevancePolicy });
const secondPage = buildModuleEvidenceCatalog("clinical_trials", "Botulinum toxin", corpus.findings, { page: 2, pageSize: 12 }, { relevancePolicy: corpus.relevancePolicy });
const placeboSearch = buildModuleEvidenceCatalog("clinical_trials", "Botulinum toxin", corpus.findings, { query: "placebo", page: 1, pageSize: 12 }, { relevancePolicy: corpus.relevancePolicy });
assert(firstPage.total === corpus.findings.length && firstPage.items.length === 12 && firstPage.pageCount > 400, "View all evidence must paginate the complete retained corpus.");
assert(secondPage.page === 2 && secondPage.items.length === 12, "The evidence catalog must provide subsequent pages.");
assert(!secondPage.items.some((item) => firstPage.items.some((first) => first.findingId === item.findingId)), "Evidence catalog pages must not repeat a singular mention.");
assert(placeboSearch.total > 500 && placeboSearch.items.length === 12, "Evidence search must find and paginate pre-qualified records containing the requested term anywhere in the canonical record.");
assert(firstPage.filters.evidenceClasses.some((item) => item.label === "clinical_study"), "The evidence browser must expose every available evidence class as a filter.");

const route = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/module-intelligence/route.ts"), "utf8");
const evidenceRoute = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/module-intelligence/evidence/route.ts"), "utf8");
const view = fs.readFileSync(path.resolve(process.cwd(), "src/components/ModuleIntelligenceView.jsx"), "utf8");
assert(route.includes("loadCanonicalFindingsForModule(therapeuticArea, moduleId)"), "The module API must route through module-specific corpus resolution.");
assert(evidenceRoute.includes("buildModuleEvidenceCatalog") && evidenceRoute.includes("pageSize"), "The evidence API must provide governed server-side search and pagination.");
for (const phrase of ["Representative module evidence", "View all evidence", "Search mention text, source, author, or taxonomy", "Pre-qualified relevance · quality-ranked", 'module.id === "clinical_trials"', "evidenceDisplayTitle(item, module.name)"]) {
  assert(view.includes(phrase), `The Clinical Trials evidence browser is missing: ${phrase}`);
}

console.log(JSON.stringify({
  therapeuticArea: "Botulinum toxin",
  module: intelligence.moduleLabel,
  sourceRows: sourceRows.length,
  canonicalFindings: corpus.findings.length,
  eligibleFindings: intelligence.dataQuality.eligibleFindingCount,
  contextualFindings: intelligence.dataQuality.contextualEvidenceFindingCount,
  directStudyEvidence: intelligence.evidence.filter((item) => item.evidenceClass === "clinical_study").length,
  actionableSourceUrls: intelligence.evidence.filter((item) => item.url?.startsWith("http")).length,
  retainedPrequalifiedMentions: firstPage.total,
  unresolvedEvidenceClasses: intelligence.dataQuality.unclassifiedFindingCount,
  unresolvedAudiences: intelligence.dataQuality.unspecifiedAudienceFindingCount,
  evidencePages: firstPage.pageCount,
  placeboSearchMatches: placeboSearch.total,
  sections: intelligence.sections.map((section) => ({ id: section.id, findings: section.findingCount, confidence: section.confidence })),
}, null, 2));
