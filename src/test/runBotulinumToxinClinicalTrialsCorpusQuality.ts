import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseMeltwaterCsv } from "../ingestion/adapters/meltwaterAdapter";
import { loadCanonicalFindingsForModule } from "../lib/answers/loadCanonicalFindingsForAsk";
import { buildModuleIntelligence } from "../lib/module-intelligence/buildModuleIntelligence";

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
assert(corpus.findings.length === 3_794, "The approved ingestion profile must retain the expected quality-filtered finding set.");
assert(corpus.findings.every((finding) => finding.therapeuticArea === "Botulinum toxin"), "Every finding must remain scoped to Botulinum toxin.");

const intelligence = buildModuleIntelligence("clinical_trials", "Botulinum toxin", corpus.findings, "2026-08-15T16:00:00.000Z");
assert(intelligence.dataQuality.corpusFindingCount === corpus.findings.length, "Clinical Trials must analyze the complete dedicated canonical corpus.");
assert(intelligence.dataQuality.assessment === "adequate" && intelligence.dataQuality.contextualEvidenceFindingCount >= 150, "The corpus must provide adequate contextual trial evidence.");
assert(intelligence.sections.every((section) => section.findingCount > 0), "Recruitment, retention, protocol, and site-experience analyses must all receive evidence.");
assert(intelligence.evidence.length === 16, "The Clinical Trials output must retain a full, deduplicated evidence set.");
assert(intelligence.evidence.filter((item) => item.evidenceClass === "clinical_study").length >= 5, "Direct clinical-study evidence must materially support the output.");
assert(new Set(intelligence.evidence.map((item) => item.findingId)).size === intelligence.evidence.length, "A mention must not appear more than once in Clinical Trials module evidence.");

const route = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/module-intelligence/route.ts"), "utf8");
assert(route.includes("loadCanonicalFindingsForModule(therapeuticArea, moduleId)"), "The module API must route through module-specific corpus resolution.");

console.log(JSON.stringify({
  therapeuticArea: "Botulinum toxin",
  module: intelligence.moduleLabel,
  sourceRows: sourceRows.length,
  canonicalFindings: corpus.findings.length,
  eligibleFindings: intelligence.dataQuality.eligibleFindingCount,
  contextualFindings: intelligence.dataQuality.contextualEvidenceFindingCount,
  directStudyEvidence: intelligence.evidence.filter((item) => item.evidenceClass === "clinical_study").length,
  sections: intelligence.sections.map((section) => ({ id: section.id, findings: section.findingCount, confidence: section.confidence })),
}, null, 2));
