import { CLIENT_AUDIENCE_GROUPS, CLIENT_GROUP_BY_ROLE } from "../src/answering/personas/clientAudienceGroups";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { parseMeltwaterCsv, adaptMeltwaterRows } from "../src/ingestion/adapters/meltwaterAdapter";
import { glp1Profile } from "../src/ingestion/profiles/glp1Profile";
import { classifyGlp1Audience, GLP1_AUDIENCE_VERSION } from "../src/ingestion/glp1Audience";
import { AUDIENCE_ROLES, CONVERSATION_SEGMENTS } from "../src/ingestion/audienceSegments";

// This is a reproducible corpus data export, including records excluded from
// analytics. Original source columns are preserved alongside audit columns.
const sourcePath = process.argv[2] || "data/glp-1.csv";
const outputDir = "artifacts/glp-1-audience-analysis";
const rows = parseMeltwaterCsv(sourcePath);
const retained = new Set(adaptMeltwaterRows(rows, { sourceType: "meltwater", profile: glp1Profile }).map(row => row.sourceId));
const records = rows.map((source, index) => ({
  sourceRow: index + 2, source, classification: classifyGlp1Audience(source), analyticalInclusion: retained.has(source["Document ID"]),
}));
const counts = (items: typeof records, field: "audience" | "designation") => items.reduce<Record<string, number>>((acc, item) => {
  const key = item.classification[field]; acc[key] = (acc[key] || 0) + 1; return acc;
}, {});
const summarize = (items: typeof records) => ({
  clientAudienceCounts: items.reduce<Record<string, number>>((acc, item) => { const key = CLIENT_GROUP_BY_ROLE[item.classification.audience]; acc[key] = (acc[key] || 0) + 1; return acc; }, {}),
  rowCount: items.length, audienceCounts: counts(items, "audience"), designationCounts: counts(items, "designation"),
  conversationSegmentCounts: items.reduce<Record<string, number>>((acc, item) => { const key = item.classification.contentSegment; acc[key] = (acc[key] || 0) + 1; return acc; }, {}),
  roleByConversation: items.reduce<Record<string, Record<string, number>>>((acc, item) => { const c = item.classification; acc[c.audience] ||= {}; acc[c.audience][c.contentSegment] = (acc[c.audience][c.contentSegment] || 0) + 1; return acc; }, {}),
  patientLabeledCount: items.filter(x => x.classification.audience === "patient").length,
  patientExperienceCount: items.filter(x => x.classification.designation === "likely_personal_experience").length,
  prospectivePatientCount: items.filter(x => x.classification.designation === "prospective_patient").length,
  patientRelatedContentCount: items.filter(x => x.classification.patientContent).length,
  caregiverCount: items.filter(x => x.classification.audience === "caregiver").length,
  unassignedCount: items.filter(x => !x.classification.audience || /unknown/i.test(x.classification.audience)).length,
});
const summary = {
  version: GLP1_AUDIENCE_VERSION, sourcePath, sourceSha256: crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"),
  clientGroupDefinitions: CLIENT_AUDIENCE_GROUPS,
  roleDefinitions: AUDIENCE_ROLES, conversationDefinitions: CONVERSATION_SEGMENTS,
  fullExport: summarize(records), analyticalCorpus: summarize(records.filter(x => x.analyticalInclusion)),
  previousCommunityObserver: summarize(records.filter(x => x.classification.previousAudience === "community_observer")),
  languages: Object.fromEntries([...new Set(rows.map(x => x.Language || "not_supplied"))].map(language => [language, summarize(records.filter(x => (x.source.Language || "not_supplied") === language))])),
  limitations: [
    "Machine classifications, not verified patient identities or a representative patient panel.",
    "All patient/caregiver voice labels require human validation; confidence scores are heuristic, not calibrated probabilities.",
    "Prospective-patient questions are distinct from accounts of personal use.",
    "Patient-community membership, reshared patient speech, and media-reported patient stories are not counted as direct patient voices.",
    "Pattern coverage is language-dependent; general commentary and insufficient-context designations do not prove non-patient identity.",
    "One export row is one unit; reposts and repeated authors are not unique patients.",
  ],
};
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
fs.writeFileSync(path.join(outputDir, "all-records.jsonl"), records.map(x => JSON.stringify(x)).join("\n") + "\n");
const originalColumns = Object.keys(rows[0]);
const auditColumns = ["Audience Label", "Legacy Content Designation", "Patient Related Content", "Eligible Patient Voice", "Audience Confidence", "Audience Rationale", "Matched Evidence", "Human Review Required", "Analytical Inclusion", "Audience Version", "Source Row", "Audience Name", "Conversation Segment", "Conversation Name", "Role Evidence Basis", "Role Evidence", "Previous Audience", "Client Audience Group", "Client Audience Group Name"];
const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
// The existing Meltwater reader preserves TSV cell quoting literally. Decode
// that transport quoting when converting to a conventional CSV so values round
// trip through standard spreadsheet readers. JSONL retains the raw cells.
const sourceValue = (value: unknown) => {
  const text = String(value ?? "");
  return text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1).replace(/""/g, '"') : text;
};
const csv = [originalColumns.concat(auditColumns).map(quote).join(","), ...records.map(({ source, classification: c, analyticalInclusion, sourceRow }) => [
  ...originalColumns.map(key => sourceValue(source[key])), c.audience, c.designation, c.patientContent, c.eligiblePatientVoice, c.confidence,
  c.signals.join("; "), c.matchedEvidence.join("; "), c.reviewRequired, analyticalInclusion, c.version, sourceRow,
  AUDIENCE_ROLES[c.audience].label, c.contentSegment, CONVERSATION_SEGMENTS[c.contentSegment], c.roleBasis, c.roleEvidence.join("; "), c.previousAudience, CLIENT_GROUP_BY_ROLE[c.audience], CLIENT_AUDIENCE_GROUPS.find(group => group.id === CLIENT_GROUP_BY_ROLE[c.audience])!.label,
].map(quote).join(","))].join("\r\n") + "\r\n";
fs.writeFileSync(path.join(outputDir, "GLP-1-labeled.csv"), "\uFEFF" + csv);
console.log(JSON.stringify({ ...summary, languages: undefined }, null, 2));
