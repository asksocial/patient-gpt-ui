import type {
  CanonicalFinding,
} from "../answering/models/finding";
import {
  loadCanonicalFindingsForAsk,
} from "../lib/answers/loadCanonicalFindingsForAsk";
import {
  buildMedicalAestheticsEvidenceLabels,
  MEDICAL_AESTHETICS_LABEL_COLUMNS,
  serializeMedicalAestheticsEvidenceLabels,
  summarizeMedicalAestheticsEvidenceLabels,
} from "../lib/evaluation/medicalAestheticsEvidenceLabels";

const corpus =
  loadCanonicalFindingsForAsk(
    "Medical Aesthetics"
  );

if (corpus.status !== "available") {
  throw new Error(
    "Medical Aesthetics corpus must be available for labeling."
  );
}

const labels =
  buildMedicalAestheticsEvidenceLabels(
    corpus.findings as CanonicalFinding[]
  );
const summary =
  summarizeMedicalAestheticsEvidenceLabels(
    labels
  );

for (const group of [
  "patient",
  "provider_hcp",
  "company",
  "media",
  "other",
]) {
  if (
    !summary.sourceGroups[group]
  ) {
    throw new Error(
      `Expected at least one ${group} prelabel.`
    );
  }
}

if (
  labels.length !==
    corpus.findings.length ||
  summary.promotionalCount === 0 ||
  summary.humanGoldLabelsPopulated ||
  !summary.reviewPriorities.high ||
  !summary.reviewPriorities.medium ||
  !summary.reviewPriorities.low
) {
  throw new Error(
    "The labeling sidecar must cover the corpus, preserve blank human gold fields, and prioritize review."
  );
}

const csv =
  serializeMedicalAestheticsEvidenceLabels(
    labels
  );
const header =
  csv.split("\n", 1)[0];

if (
  !MEDICAL_AESTHETICS_LABEL_COLUMNS.every(
    (column) =>
      header.includes(
        `"${column}"`
      )
  )
) {
  throw new Error(
    "The labeling CSV is missing required review columns."
  );
}

console.log(
  JSON.stringify(
    summary,
    null,
    2
  )
);
