import type { PvBinaryMetrics, PvBinaryTruth, PvConfusionMatrix, PvReviewerLabel } from "./types";

export function reviewerLabelToBinary(label: PvReviewerLabel): PvBinaryTruth | null {
  if (label === "NON_CASE") return "NEGATIVE";
  if (label === "NEEDS_SECOND_REVIEW") return null;
  return "POSITIVE";
}

function safeDivide(numerator: number, denominator: number) {
  return denominator ? Number((numerator / denominator).toFixed(6)) : null;
}

export function calculateBinaryMetrics(rows: Array<{ model_positive: boolean; truth: PvBinaryTruth | null }>): PvBinaryMetrics {
  const matrix: PvConfusionMatrix = { true_positive: 0, true_negative: 0, false_positive: 0, false_negative: 0 };
  let excluded = 0;
  for (const row of rows) {
    if (!row.truth) {
      excluded += 1;
      continue;
    }
    if (row.model_positive && row.truth === "POSITIVE") matrix.true_positive += 1;
    else if (!row.model_positive && row.truth === "NEGATIVE") matrix.true_negative += 1;
    else if (row.model_positive) matrix.false_positive += 1;
    else matrix.false_negative += 1;
  }
  const { true_positive: tp, true_negative: tn, false_positive: fp, false_negative: fn } = matrix;
  const precision = safeDivide(tp, tp + fp);
  const recall = safeDivide(tp, tp + fn);
  return {
    evaluated_records: tp + tn + fp + fn,
    excluded_records: excluded,
    sensitivity_recall: recall,
    specificity: safeDivide(tn, tn + fp),
    precision,
    false_positive_rate: safeDivide(fp, fp + tn),
    false_negative_rate: safeDivide(fn, fn + tp),
    f1: precision === null || recall === null || precision + recall === 0 ? null : Number((2 * precision * recall / (precision + recall)).toFixed(6)),
    confusion_matrix: matrix,
  };
}
