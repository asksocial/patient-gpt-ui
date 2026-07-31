import {
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type {
  CanonicalFinding,
} from "../src/answering/models/finding";
import {
  loadCanonicalFindingsForAsk,
} from "../src/lib/answers/loadCanonicalFindingsForAsk";
import {
  buildMedicalAestheticsEvidenceLabels,
} from "../src/lib/evaluation/medicalAestheticsEvidenceLabels";
import {
  buildMedicalAestheticsHighPriorityReview,
  serializeMedicalAestheticsHighPriorityReview,
  summarizeMedicalAestheticsHighPriorityReview,
} from "../src/lib/evaluation/medicalAestheticsHighPriorityReview";

const outputPath = path.resolve(
  process.cwd(),
  "data/medical-aesthetics-high-priority-review.csv"
);
const summaryPath = path.resolve(
  process.cwd(),
  "data/medical-aesthetics-high-priority-review.summary.json"
);
const corpus =
  loadCanonicalFindingsForAsk(
    "Medical Aesthetics"
  );

if (corpus.status !== "available") {
  throw new Error(
    "Medical Aesthetics corpus is unavailable."
  );
}

const labels =
  buildMedicalAestheticsEvidenceLabels(
    corpus.findings as CanonicalFinding[]
  );
const reviewRows =
  buildMedicalAestheticsHighPriorityReview(
    labels
  );
const summary = {
  sourceFile:
    "data/medical-aesthetics-evidence-labels.csv",
  outputFile:
    "data/medical-aesthetics-high-priority-review.csv",
  ...summarizeMedicalAestheticsHighPriorityReview(
    reviewRows
  ),
  limitations: [
    "AI review proposals are not human gold labels.",
    "Unresolved rows require manual review before evaluation use.",
    "Proposed corrections require human confirmation or adjudication.",
  ],
};

writeFileSync(
  outputPath,
  `${serializeMedicalAestheticsHighPriorityReview(
    reviewRows
  )}\n`,
  "utf8"
);
writeFileSync(
  summaryPath,
  `${JSON.stringify(
    summary,
    null,
    2
  )}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    summary,
    null,
    2
  )
);
