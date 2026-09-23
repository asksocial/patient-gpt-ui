import datasetJson from "../../../../config/pv/evaluation/botulinum-toxin/gold-candidate-2026.01.0.json";
import regressionsJson from "../../../../config/pv/evaluation/botulinum-toxin/false-negative-regressions-2026.01.0.json";
import manifestJson from "../../../../config/pv/evaluation/botulinum-toxin/manifest.json";
import { PV_EVALUATION_SLICES, PV_REVIEWER_LABELS, type PvEvaluationSlice, type PvFalseNegativeRegressionRecord, type PvGoldCandidateRecord, type PvReviewerLabel } from "./types";

type RawRecord = typeof datasetJson.records[number] | typeof regressionsJson.records[number];

function validateDate(value: string, field: string) {
  if (Number.isNaN(new Date(value).getTime())) throw new Error(`Invalid ${field} in PV evaluation configuration.`);
}

function materialize(raw: RawRecord, datasetVersion: string, source: "SEEDED_EVALUATION_DESIGN" | "KNOWN_FALSE_NEGATIVE_REGRESSION"): PvGoldCandidateRecord {
  if (!raw.id.trim() || !raw.text.trim() || !raw.rationale.trim()) throw new Error("Evaluation records require ID, text, and rationale.");
  if (!PV_REVIEWER_LABELS.includes(raw.label as PvReviewerLabel)) throw new Error(`Invalid evaluation label on ${raw.id}.`);
  if (raw.label === "NEEDS_SECOND_REVIEW") throw new Error(`Seeded reference labels cannot use NEEDS_SECOND_REVIEW: ${raw.id}.`);
  const label = raw.label as Exclude<PvReviewerLabel, "NEEDS_SECOND_REVIEW">;
  if (raw.truth !== (label === "NON_CASE" ? "NEGATIVE" : "POSITIVE")) throw new Error(`Binary truth conflicts with reviewer label on ${raw.id}.`);
  for (const slice of raw.slices) if (!PV_EVALUATION_SLICES.includes(slice as PvEvaluationSlice)) throw new Error(`Unknown evaluation slice '${slice}' on ${raw.id}.`);
  for (const element of raw.missing) if (!["P", "R", "D", "E"].includes(element)) throw new Error(`Unknown ICSR element '${element}' on ${raw.id}.`);
  const defaults = datasetJson.sourceDefaults;
  validateDate(defaults.originalTimestamp, "original timestamp");
  validateDate(defaults.collectionTimestamp, "collection timestamp");
  return {
    record_id: raw.id,
    dataset_version: datasetVersion,
    text: raw.text,
    source: {
      platform: defaults.platform,
      url: `${defaults.baseUrl}${raw.id}`,
      id: raw.id,
      author_identifier: raw.author,
      original_timestamp: defaults.originalTimestamp,
      collection_timestamp: defaults.collectionTimestamp,
    },
    provisional_reference_label: label,
    provisional_binary_truth: raw.truth,
    reference_label_source: source,
    adjudication_status: "PENDING_PV_REVIEW",
    slice_tags: [...raw.slices] as PvEvaluationSlice[],
    expected_icsr_missing_elements: [...raw.missing] as Array<"P" | "R" | "D" | "E">,
    rationale: raw.rationale,
  };
}

const dataset = datasetJson.records.map((record) => materialize(record, datasetJson.datasetVersion, "SEEDED_EVALUATION_DESIGN"));
const regressions: PvFalseNegativeRegressionRecord[] = regressionsJson.records.map((record) => ({
  ...materialize(record, regressionsJson.datasetVersion, "KNOWN_FALSE_NEGATIVE_REGRESSION"),
  regression_reason: record.regressionReason,
  introduced_in_classifier_version: manifestJson.classifierVersion,
  expected_model_route: "PV review required",
}));

if (manifestJson.datasetVersion !== datasetJson.datasetVersion) throw new Error("PV evaluation dataset version mismatch.");
if (manifestJson.status !== datasetJson.status) throw new Error("PV evaluation dataset status mismatch.");
if (new Set(dataset.map((record) => record.record_id)).size !== dataset.length) throw new Error("Duplicate PV gold-candidate record IDs.");
if (new Set(regressions.map((record) => record.record_id)).size !== regressions.length) throw new Error("Duplicate PV false-negative regression IDs.");
for (const slice of PV_EVALUATION_SLICES) if (!dataset.some((record) => record.slice_tags.includes(slice))) throw new Error(`PV gold-candidate dataset does not cover ${slice}.`);

export function getBotulinumPvEvaluationConfiguration() {
  return { manifest: manifestJson, dataset: structuredClone(dataset), regressions: structuredClone(regressions) };
}
