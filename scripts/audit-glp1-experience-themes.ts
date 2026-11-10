import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadCanonicalFindingsForAsk } from "../src/lib/answers/loadCanonicalFindingsForAsk";
import { selectSearchCorpusForQuestion } from "../src/lib/answers/loadSearchCorpusIntelligence";
import { classifyGlp1ExperienceThemes, GLP1_EXPERIENCE_LABEL_VERSION } from "../src/answering/personas/glp1ExperienceThemes";

const question = "What are patients and caregivers saying about their treatment experiences?";
const corpus = loadCanonicalFindingsForAsk("GLP-1");
const selection = selectSearchCorpusForQuestion("GLP-1", corpus.findings, question);
const charts = selection.summary.corpusCharts!;
const rows = selection.findings.map(finding => {
  const labels = classifyGlp1ExperienceThemes(finding);
  const fields = finding.rawMetadata?.fields || {};
  return { id: finding.findingId, country: finding.countries?.[0] || (finding as any).country, url: fields.URL || "", title: fields.Title || "", previous: finding.symptoms, ...labels };
});
const formerlyResidual = rows.filter(row => !row.previous.some(s => ["weight and metabolic outcomes", "appetite and eating"].includes(s)));
const summary = {
  labelVersion: GLP1_EXPERIENCE_LABEL_VERSION, question,
  sourceSha256: createHash("sha256").update(fs.readFileSync("data/glp-1.csv")).digest("hex"),
  analyticalPosts: charts.burdens.denominator, audienceSourcePosts: selection.summary.denominator,
  previousResidual: formerlyResidual.length,
  recoveredFromPreviousResidual: formerlyResidual.filter(row => row.primary).length,
  labeled: charts.burdens.highlightCount,
  remaining: charts.burdens.segments.find(segment => segment.id === "remainder")!.count,
  categories: charts.burdens.segments.map(segment => ({ ...segment, percent: +(segment.count / charts.burdens.denominator * 100).toFixed(1) })),
  methodology: charts.burdens.note,
};
const output = path.resolve(process.argv[2] || "artifacts/glp-1-experience-themes");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "GLP1_Experience_Label_Summary.json"), JSON.stringify(summary, null, 2) + "\n");
const csv = (values: unknown[]) => values.map(value => '"' + String(value ?? "").replaceAll('"', '""') + '"').join(",");
fs.writeFileSync(path.join(output, "GLP1_Experience_Label_Audit.csv"), "\uFEFF" + [
  csv(["Finding ID", "Country", "Source URL", "Title", "Previous symptom labels", "Primary chart label", "All supported labels", "Matched source phrases"]),
  ...rows.map(row => csv([row.id, row.country, row.url, row.title, row.previous.join("; "), row.primary?.label || "No specific experience stated", row.matches.map(m => m.label).join("; "), row.matches.map(m => `${m.label}: ${m.evidence.join(" | ")}`).join("; ")])),
].join("\n") + "\n");
console.log(JSON.stringify(summary, null, 2));
