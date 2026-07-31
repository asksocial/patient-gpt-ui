import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  analyzeEvidence,
  normalizeEvidenceMetadata,
} from "../../answering/evidence";
import {
  assignThemesToFindings,
} from "../../answering/themes/assignThemes";

export const MEDICAL_AESTHETICS_LABEL_VERSION =
  "medical_aesthetics_silver_v1";

export const MEDICAL_AESTHETICS_LABEL_COLUMNS = [
  "document_id",
  "source_url",
  "source_name",
  "author_name",
  "author_handle",
  "author_bio",
  "title",
  "excerpt",
  "published_at",
  "country",
  "platform",
  "source_group_silver",
  "author_identity_silver",
  "communication_intent_silver",
  "publication_archetype_silver",
  "evidence_class_silver",
  "authority_level_silver",
  "evidence_role_silver",
  "commercial_intent_silver",
  "is_promotional_silver",
  "is_secondary_voice_silver",
  "medical_aesthetics_relevance_silver",
  "theme_ids_silver",
  "classification_confidence",
  "ontology_confidence",
  "evidence_quality_score",
  "evidence_quality_band",
  "review_priority",
  "label_version",
  "label_rationale",
  "human_author_identity_gold",
  "human_communication_intent_gold",
  "human_publication_archetype_gold",
  "human_evidence_class_gold",
  "human_commercial_intent_gold",
  "human_is_promotional_gold",
  "human_medical_aesthetics_relevance_gold",
  "reviewer_confidence",
  "reviewer_id",
  "adjudication_status",
  "notes",
] as const;

export type MedicalAestheticsLabelColumn =
  (typeof MEDICAL_AESTHETICS_LABEL_COLUMNS)[number];

export type MedicalAestheticsSourceGroup =
  | "patient"
  | "provider_hcp"
  | "company"
  | "media"
  | "other";

export type MedicalAestheticsEvidenceLabel =
  Record<
    MedicalAestheticsLabelColumn,
    string
  >;

function getFindingId(
  finding: CanonicalFinding
) {
  const candidate =
    finding as CanonicalFinding & {
      id?: string;
      sourceId?: string;
    };
  return String(
    candidate.findingId ||
      candidate.id ||
      candidate.sourceId ||
      ""
  ).trim();
}

function getSourceGroup(
  authorIdentity: string,
  evidenceClass: string
): MedicalAestheticsSourceGroup {
  if (
    authorIdentity === "patient"
  ) {
    return "patient";
  }
  if (
    authorIdentity === "provider"
  ) {
    return "provider_hcp";
  }
  if (
    [
      "brand",
      "clinic",
      "retailer",
    ].includes(authorIdentity)
  ) {
    return "company";
  }
  if (
    authorIdentity ===
      "journalist" ||
    [
      "consumer_news",
      "healthcare_news",
      "healthcare_trade_publication",
    ].includes(evidenceClass)
  ) {
    return "media";
  }
  return "other";
}

function getReviewPriority(params: {
  authorIdentity: string;
  communicationIntent: string;
  publicationArchetype: string;
  classificationConfidence: number;
  ontologyConfidence: number;
  isSecondaryVoice: boolean;
  sourceGroup:
    MedicalAestheticsSourceGroup;
}) {
  const hasUnknown = [
    params.authorIdentity,
    params.communicationIntent,
    params.publicationArchetype,
  ].includes("unknown");
  const minimumConfidence =
    Math.min(
      params.classificationConfidence,
      params.ontologyConfidence
    );

  if (
    hasUnknown ||
    minimumConfidence < 0.55
  ) {
    return "high";
  }
  if (
    minimumConfidence < 0.75 ||
    params.isSecondaryVoice ||
    params.sourceGroup === "other"
  ) {
    return "medium";
  }
  return "low";
}

export function buildMedicalAestheticsEvidenceLabels(
  findings: CanonicalFinding[]
): MedicalAestheticsEvidenceLabel[] {
  const themed =
    assignThemesToFindings(
      findings,
      "medical_aesthetics"
    );

  return themed.map((finding) => {
    const metadata =
      normalizeEvidenceMetadata(
        finding
      );
    const intelligence =
      analyzeEvidence(finding);
    const ontology =
      intelligence.ontology;
    const themeIds =
      Array.isArray(
        (
          finding as CanonicalFinding & {
            themes?: unknown[];
          }
        ).themes
      )
        ? (
            finding as CanonicalFinding & {
              themes: unknown[];
            }
          ).themes.map(String)
        : [];
    const sourceGroup =
      getSourceGroup(
        ontology.authorIdentity,
        intelligence.evidenceClass
      );
    const reviewPriority =
      getReviewPriority({
        authorIdentity:
          ontology.authorIdentity,
        communicationIntent:
          ontology.communicationIntent,
        publicationArchetype:
          ontology.publicationArchetype,
        classificationConfidence:
          intelligence.classificationConfidence,
        ontologyConfidence:
          ontology.overallConfidence,
        isSecondaryVoice:
          !!ontology.isSecondaryVoice,
        sourceGroup,
      });
    const rationale =
      intelligence.reasons
        .slice(0, 6)
        .join(" | ");

    return {
      document_id:
        getFindingId(finding),
      source_url:
        metadata.url || "",
      source_name:
        metadata.sourceName ||
        metadata.publication ||
        "",
      author_name:
        metadata.author || "",
      author_handle:
        metadata.authorHandle ||
        "",
      author_bio:
        metadata.authorBio || "",
      title: metadata.title || "",
      excerpt:
        metadata.excerpt ||
        metadata.hitSentence ||
        "",
      published_at:
        metadata.publishedAt ||
        "",
      country:
        metadata.country || "",
      platform:
        metadata.platform || "",
      source_group_silver:
        sourceGroup,
      author_identity_silver:
        ontology.authorIdentity,
      communication_intent_silver:
        ontology.communicationIntent,
      publication_archetype_silver:
        ontology.publicationArchetype,
      evidence_class_silver:
        intelligence.evidenceClass,
      authority_level_silver:
        ontology.authorityLevel,
      evidence_role_silver:
        ontology.evidenceRole,
      commercial_intent_silver:
        intelligence.commercialIntent,
      is_promotional_silver:
        intelligence.isPromotional
          ? "yes"
          : "no",
      is_secondary_voice_silver:
        ontology.isSecondaryVoice
          ? "yes"
          : "no",
      medical_aesthetics_relevance_silver:
        themeIds.length
          ? "theme_supported"
          : "profile_supported_needs_review",
      theme_ids_silver:
        themeIds.join("|"),
      classification_confidence:
        intelligence.classificationConfidence.toFixed(
          2
        ),
      ontology_confidence:
        ontology.overallConfidence.toFixed(
          2
        ),
      evidence_quality_score:
        String(
          intelligence.qualityScore
        ),
      evidence_quality_band:
        intelligence.qualityBand,
      review_priority:
        reviewPriority,
      label_version:
        MEDICAL_AESTHETICS_LABEL_VERSION,
      label_rationale:
        rationale,
      human_author_identity_gold:
        "",
      human_communication_intent_gold:
        "",
      human_publication_archetype_gold:
        "",
      human_evidence_class_gold:
        "",
      human_commercial_intent_gold:
        "",
      human_is_promotional_gold:
        "",
      human_medical_aesthetics_relevance_gold:
        "",
      reviewer_confidence: "",
      reviewer_id: "",
      adjudication_status:
        "unreviewed_machine_prelabel",
      notes: "",
    };
  });
}

function csvCell(value: string) {
  return `"${value.replace(
    /"/g,
    '""'
  )}"`;
}

export function serializeMedicalAestheticsEvidenceLabels(
  rows:
    MedicalAestheticsEvidenceLabel[]
) {
  return [
    MEDICAL_AESTHETICS_LABEL_COLUMNS.map(
      csvCell
    ).join(","),
    ...rows.map((row) =>
      MEDICAL_AESTHETICS_LABEL_COLUMNS.map(
        (column) =>
          csvCell(row[column])
      ).join(",")
    ),
  ].join("\n");
}

function increment(
  counts: Record<string, number>,
  value: string
) {
  counts[value] =
    (counts[value] || 0) + 1;
}

export function summarizeMedicalAestheticsEvidenceLabels(
  rows:
    MedicalAestheticsEvidenceLabel[]
) {
  const sourceGroups:
    Record<string, number> = {};
  const authorIdentities:
    Record<string, number> = {};
  const evidenceClasses:
    Record<string, number> = {};
  const reviewPriorities:
    Record<string, number> = {};
  const relevance:
    Record<string, number> = {};
  let promotionalCount = 0;

  for (const row of rows) {
    increment(
      sourceGroups,
      row.source_group_silver
    );
    increment(
      authorIdentities,
      row.author_identity_silver
    );
    increment(
      evidenceClasses,
      row.evidence_class_silver
    );
    increment(
      reviewPriorities,
      row.review_priority
    );
    increment(
      relevance,
      row.medical_aesthetics_relevance_silver
    );
    if (
      row.is_promotional_silver ===
      "yes"
    ) {
      promotionalCount += 1;
    }
  }

  return {
    labelVersion:
      MEDICAL_AESTHETICS_LABEL_VERSION,
    rowCount: rows.length,
    sourceGroups,
    promotionalCount,
    authorIdentities,
    evidenceClasses,
    reviewPriorities,
    relevance,
    humanGoldLabelsPopulated:
      rows.some((row) =>
        [
          row.human_author_identity_gold,
          row.human_communication_intent_gold,
          row.human_publication_archetype_gold,
          row.human_evidence_class_gold,
          row.human_commercial_intent_gold,
          row.human_is_promotional_gold,
          row.human_medical_aesthetics_relevance_gold,
        ].some(Boolean)
      ),
  };
}
