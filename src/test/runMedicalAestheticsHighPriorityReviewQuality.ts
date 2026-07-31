import type {
  CanonicalFinding,
} from "../answering/models/finding";
import {
  loadCanonicalFindingsForAsk,
} from "../lib/answers/loadCanonicalFindingsForAsk";
import {
  buildMedicalAestheticsEvidenceLabels,
} from "../lib/evaluation/medicalAestheticsEvidenceLabels";
import {
  buildMedicalAestheticsHighPriorityReview,
  summarizeMedicalAestheticsHighPriorityReview,
} from "../lib/evaluation/medicalAestheticsHighPriorityReview";

const corpus =
  loadCanonicalFindingsForAsk(
    "Medical Aesthetics"
  );

if (corpus.status !== "available") {
  throw new Error(
    "Medical Aesthetics corpus must be available for review."
  );
}

const labels =
  buildMedicalAestheticsEvidenceLabels(
    corpus.findings as CanonicalFinding[]
  );
const highPriorityCount =
  labels.filter(
    (row) =>
      row.review_priority ===
      "high"
  ).length;
const reviewRows =
  buildMedicalAestheticsHighPriorityReview(
    labels
  );
const summary =
  summarizeMedicalAestheticsHighPriorityReview(
    reviewRows
  );

if (
  reviewRows.length !==
    highPriorityCount ||
  !summary.dispositions
    .proposed_correction ||
  !summary.dispositions
    .unresolved ||
  summary.humanGoldLabelsPopulated ||
  reviewRows.some(
    (row) =>
      row.adjudication_status !==
      "ai_reviewed_pending_human"
  )
) {
  throw new Error(
    "High-priority review must cover every queued row, retain unresolved cases, and never populate human gold labels."
  );
}

const repostCorrection =
  reviewRows.find(
    (row) =>
      row.silver_publication_archetype ===
      "social_repost"
  );

if (
  repostCorrection?.ai_review_author_identity !==
    "community_member" ||
  repostCorrection.ai_review_evidence_class !==
    "community_conversation"
) {
  throw new Error(
    "Reposts must be labeled by the posting account instead of inheriting an embedded identity."
  );
}

console.log(
  JSON.stringify(
    summary,
    null,
    2
  )
);
