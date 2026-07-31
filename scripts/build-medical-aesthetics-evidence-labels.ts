import {
  createHash,
} from "node:crypto";
import {
  readFileSync,
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
  serializeMedicalAestheticsEvidenceLabels,
  summarizeMedicalAestheticsEvidenceLabels,
} from "../src/lib/evaluation/medicalAestheticsEvidenceLabels";

const sourcePath = path.resolve(
  process.cwd(),
  "data/regen-aesthetics.csv"
);
const outputPath = path.resolve(
  process.cwd(),
  "data/medical-aesthetics-evidence-labels.csv"
);
const summaryPath = path.resolve(
  process.cwd(),
  "data/medical-aesthetics-evidence-labels.summary.json"
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
const sourceSha256 =
  createHash("sha256")
    .update(readFileSync(sourcePath))
    .digest("hex");
const summary = {
  sourceFile:
    "data/regen-aesthetics.csv",
  sourceSha256,
  outputFile:
    "data/medical-aesthetics-evidence-labels.csv",
  ...summarizeMedicalAestheticsEvidenceLabels(
    labels
  ),
  reviewGuidance: {
    high:
      "Review first: an ontology dimension is unknown or confidence is below 0.55.",
    medium:
      "Review next: confidence is below 0.75, the record contains a secondary voice, or the source group is other.",
    low:
      "Still requires human review before use as a gold label.",
  },
};

writeFileSync(
  outputPath,
  `${serializeMedicalAestheticsEvidenceLabels(
    labels
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
