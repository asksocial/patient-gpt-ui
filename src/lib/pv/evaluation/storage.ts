import fs from "node:fs";
import path from "node:path";
import type { PvAdjudicationEvent, PvEvaluationReport, PvModelDecisionSnapshot } from "./types";

function writeNew(filePath: string, contents: string) {
  fs.writeFileSync(filePath, contents, { encoding: "utf8", flag: "wx" });
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function writePvEvaluationRun(options: {
  outputDirectory: string;
  snapshots: PvModelDecisionSnapshot[];
  regressionSnapshots: PvModelDecisionSnapshot[];
  report: PvEvaluationReport;
}) {
  const outputDirectory = path.resolve(options.outputDirectory);
  if (fs.existsSync(outputDirectory)) throw new Error(`Evaluation snapshot already exists: ${outputDirectory}`);
  fs.mkdirSync(outputDirectory, { recursive: true });
  writeNew(path.join(outputDirectory, "model-decisions.jsonl"), `${options.snapshots.map((item) => JSON.stringify(item)).join("\n")}\n`);
  writeNew(path.join(outputDirectory, "false-negative-regression-decisions.jsonl"), `${options.regressionSnapshots.map((item) => JSON.stringify(item)).join("\n")}\n`);
  writeNew(path.join(outputDirectory, "evaluation-report.json"), `${JSON.stringify(options.report, null, 2)}\n`);
  const worksheetHeader = ["record_id", "original_mention", "model_routed_for_pv_review", "model_pv_relevance", "model_icsr_status", "model_missing_elements", "reviewer_decision", "reviewer_notes", "adjudication_timestamp", "classifier_version", "taxonomy_version"];
  const worksheetRows = options.snapshots.map((item) => [
    item.record_id,
    item.structured_output.original_mention,
    item.model_decision.routed_for_pv_review,
    item.model_decision.pv_relevance,
    item.model_decision.icsr_status,
    item.model_decision.missing_elements.join("|"),
    "",
    "",
    "",
    item.classifier_version,
    item.taxonomy_version,
  ]);
  writeNew(path.join(outputDirectory, "adjudication-worksheet.csv"), `${[worksheetHeader, ...worksheetRows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`);
  writeNew(path.join(outputDirectory, "run-manifest.json"), `${JSON.stringify({
    schemaVersion: "1.0.0",
    datasetVersion: options.report.dataset_version,
    classifierVersion: options.report.classifier_version,
    taxonomyVersion: options.report.taxonomy_version,
    generatedAt: options.report.generated_at,
    metricBasis: options.report.metric_basis,
    modelDecisionCount: options.snapshots.length,
    falseNegativeRegressionCount: options.regressionSnapshots.length,
    appendOnlyAdjudicationFile: "adjudication-events.jsonl",
    reviewerWorksheet: "adjudication-worksheet.csv",
  }, null, 2)}\n`);
  return outputDirectory;
}

export function appendAdjudicationEventFile(filePath: string, event: PvAdjudicationEvent) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.appendFileSync(resolved, `${JSON.stringify(event)}\n`, { encoding: "utf8", flag: "a" });
  return resolved;
}
