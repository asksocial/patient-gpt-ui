import type {
  MedicalAestheticsEvidenceLabel,
} from "./medicalAestheticsEvidenceLabels";

export const MEDICAL_AESTHETICS_REVIEW_VERSION =
  "medical_aesthetics_ai_review_v1";

export const MEDICAL_AESTHETICS_REVIEW_COLUMNS = [
  "review_order",
  "document_id",
  "source_url",
  "source_name",
  "author_name",
  "author_handle",
  "title",
  "excerpt",
  "published_at",
  "country",
  "platform",
  "theme_ids_silver",
  "silver_source_group",
  "silver_author_identity",
  "silver_communication_intent",
  "silver_publication_archetype",
  "silver_evidence_class",
  "silver_commercial_intent",
  "silver_is_promotional",
  "silver_relevance",
  "ai_review_source_group",
  "ai_review_author_identity",
  "ai_review_communication_intent",
  "ai_review_publication_archetype",
  "ai_review_evidence_class",
  "ai_review_commercial_intent",
  "ai_review_is_promotional",
  "ai_review_relevance",
  "ai_review_disposition",
  "ai_review_confidence",
  "ai_review_reason",
  "review_version",
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

export type MedicalAestheticsReviewColumn =
  (typeof MEDICAL_AESTHETICS_REVIEW_COLUMNS)[number];

export type MedicalAestheticsReviewRow =
  Record<
    MedicalAestheticsReviewColumn,
    string
  >;

type ReviewProposal = {
  sourceGroup: string;
  authorIdentity: string;
  communicationIntent: string;
  publicationArchetype: string;
  evidenceClass: string;
  commercialIntent: string;
  isPromotional: string;
  relevance: string;
  disposition:
    | "proposed_correction"
    | "proposed_confirmation"
    | "unresolved";
  confidence:
    | "high"
    | "medium"
    | "low";
  reasons: string[];
};

function combinedText(
  row:
    MedicalAestheticsEvidenceLabel
) {
  return [
    row.source_name,
    row.author_name,
    row.author_bio,
    row.title,
    row.excerpt,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(
  text: string,
  patterns: RegExp[]
) {
  return patterns.some(
    (pattern) =>
      pattern.test(text)
  );
}

function baseProposal(
  row:
    MedicalAestheticsEvidenceLabel
): ReviewProposal {
  return {
    sourceGroup:
      row.source_group_silver,
    authorIdentity:
      row.author_identity_silver,
    communicationIntent:
      row.communication_intent_silver,
    publicationArchetype:
      row.publication_archetype_silver,
    evidenceClass:
      row.evidence_class_silver,
    commercialIntent:
      row.commercial_intent_silver,
    isPromotional:
      row.is_promotional_silver,
    relevance:
      row.medical_aesthetics_relevance_silver,
    disposition: "unresolved",
    confidence: "low",
    reasons: [
      "No conservative second-pass rule resolved the ambiguity.",
    ],
  };
}

function changed(
  row:
    MedicalAestheticsEvidenceLabel,
  proposal: ReviewProposal
) {
  return (
    proposal.sourceGroup !==
      row.source_group_silver ||
    proposal.authorIdentity !==
      row.author_identity_silver ||
    proposal.communicationIntent !==
      row.communication_intent_silver ||
    proposal.publicationArchetype !==
      row.publication_archetype_silver ||
    proposal.evidenceClass !==
      row.evidence_class_silver ||
    proposal.commercialIntent !==
      row.commercial_intent_silver ||
    proposal.isPromotional !==
      row.is_promotional_silver ||
    proposal.relevance !==
      row.medical_aesthetics_relevance_silver
  );
}

function reviewLabel(
  row:
    MedicalAestheticsEvidenceLabel
): ReviewProposal {
  const proposal =
    baseProposal(row);
  const text =
    combinedText(row);
  const secondaryArchetype = [
    "social_repost",
    "social_quote",
    "social_reply",
  ].includes(
    row.publication_archetype_silver
  );
  const isComment =
    /^comment on\b/i.test(
      row.author_name
    );
  const verifiedHcp =
    hasAny(
      [
        row.author_name,
        row.author_bio,
        row.source_name,
      ]
        .join(" ")
        .toLowerCase(),
      [
        /\bdr\.?\b/,
        /\bm\.?d\.?\b/,
        /\bdermatologist\b/,
        /\bplastic surgeon\b/,
        /\bphysician\b/,
      ]
    );
  const explicitPromotion =
    hasAny(text, [
      /\bbook (now|a consultation|your consultation)\b/,
      /\bcall \+?\d/,
      /\bshop now\b/,
      /\badd to cart\b/,
      /\bdiscount code\b/,
      /\buse (my|our) code\b/,
      /\blink in bio\b/,
      /\bbest price\b/,
      /\bdirectly from the factory\b/,
      /\bnew service alert\b/,
      /\bcontact us\b/,
      /\bappointment availability\b/,
      /\bpaid partnership\b/,
      /\bgifted\b/,
      /\bempower your clinic\b/,
      /\bcustomer feedback\b/,
      /\bfree shipping\b/,
    ]);
  const clinicSource =
    hasAny(text, [
      /\bclinic\b/,
      /\bmedspa\b/,
      /\bmed spa\b/,
      /\baesthetics (and|&) wellness\b/,
      /\bmedical centre\b/,
      /\bmedical center\b/,
    ]);
  const editorialSource =
    hasAny(
      [
        row.source_name,
        row.title,
      ]
        .join(" ")
        .toLowerCase(),
      [
        /\bmagazine\b/,
        /\bdaily mirror\b/,
        /\bonline magazine\b/,
        /\bnews\b/,
      ]
    );
  const explicitPatientExperience =
    hasAny(text, [
      /\bi (tried|had|got|used|started|added)\b/,
      /\bmy (experience|treatment|skin|routine|filler|botox)\b/,
      /\bskin feels\b/,
    ]);
  const definiteFalsePositive =
    hasAny(text, [
      /\bpityriasis rubra pilaris\b/,
      /\bperfume\b.*\blongevity\b/,
      /\bfragrance\b.*\blongevity\b/,
    ]);

  if (definiteFalsePositive) {
    proposal.relevance =
      "not_relevant";
    proposal.disposition =
      "proposed_correction";
    proposal.confidence =
      "high";
    proposal.reasons = [
      "The matched term is a clear Medical Aesthetics false positive.",
    ];
    return proposal;
  }

  if (isComment) {
    proposal.sourceGroup =
      "other";
    proposal.authorIdentity =
      "community_member";
    proposal.communicationIntent =
      "community_discussion";
    proposal.publicationArchetype =
      "social_comment";
    proposal.evidenceClass =
      "community_conversation";
    proposal.commercialIntent =
      "none";
    proposal.isPromotional =
      "no";
    proposal.disposition =
      "proposed_correction";
    proposal.confidence =
      "high";
    proposal.reasons = [
      "The record is explicitly a comment on another creator's content.",
      "The commenter must not inherit the identity of the quoted creator.",
    ];
    return proposal;
  }

  if (secondaryArchetype) {
    proposal.sourceGroup =
      "other";
    proposal.authorIdentity =
      "community_member";
    proposal.communicationIntent =
      "community_discussion";
    proposal.evidenceClass =
      "community_conversation";
    proposal.commercialIntent =
      explicitPromotion
        ? "high"
        : "none";
    proposal.isPromotional =
      explicitPromotion
        ? "yes"
        : "no";
    proposal.disposition =
      "proposed_correction";
    proposal.confidence =
      "medium";
    proposal.reasons = [
      "The record is a repost, quote, or reply and should be labeled by the posting account.",
      "The posting account must not inherit the identity of embedded content.",
    ];
    return proposal;
  }

  if (
    explicitPromotion ||
    row.author_identity_silver ===
      "clinic"
  ) {
    const clinic =
      clinicSource ||
      row.author_identity_silver ===
        "clinic";
    proposal.sourceGroup =
      "company";
    proposal.authorIdentity =
      clinic
        ? "clinic"
        : "brand";
    proposal.communicationIntent =
      clinic
        ? "clinic_promotion"
        : "product_promotion";
    proposal.publicationArchetype =
      row.platform
        .toLowerCase()
        .includes("youtube")
        ? "promotional_video"
        : clinic
          ? "clinic_social_post"
          : "brand_social_post";
    proposal.evidenceClass =
      clinic
        ? "clinic_marketing"
        : "retail_or_product";
    proposal.commercialIntent =
      "high";
    proposal.isPromotional =
      "yes";
    proposal.disposition =
      "proposed_correction";
    proposal.confidence =
      explicitPromotion
        ? "high"
        : "medium";
    proposal.reasons = [
      explicitPromotion
        ? "The content contains an explicit commercial call to action."
        : "The source is classified as a clinic and the content promotes a treatment.",
    ];
    return proposal;
  }

  if (verifiedHcp) {
    proposal.sourceGroup =
      "provider_hcp";
    proposal.authorIdentity =
      "provider";
    proposal.communicationIntent =
      "provider_education";
    proposal.publicationArchetype =
      row.platform
        .toLowerCase()
        .includes("youtube")
        ? "educational_video"
        : "provider_social_post";
    proposal.evidenceClass =
      "provider_conversation";
    proposal.commercialIntent =
      "none";
    proposal.isPromotional =
      "no";
    proposal.disposition =
      changed(row, proposal)
        ? "proposed_correction"
        : "proposed_confirmation";
    proposal.confidence =
      "high";
    proposal.reasons = [
      "Provider identity is supported by explicit professional credentials in source metadata.",
    ];
    return proposal;
  }

  if (
    explicitPatientExperience &&
    (row.author_identity_silver ===
      "patient" ||
      [
        "testimonial_video",
        "community_review",
      ].includes(
        row.publication_archetype_silver
      ))
  ) {
    proposal.sourceGroup =
      "patient";
    proposal.authorIdentity =
      "patient";
    proposal.communicationIntent =
      "personal_experience";
    proposal.evidenceClass =
      row.platform
        .toLowerCase()
        .includes("youtube")
        ? "youtube_review"
        : "patient_conversation";
    proposal.commercialIntent =
      "none";
    proposal.isPromotional =
      "no";
    proposal.disposition =
      changed(row, proposal)
        ? "proposed_correction"
        : "proposed_confirmation";
    proposal.confidence =
      "high";
    proposal.reasons = [
      "The author uses explicit first-person treatment or skincare experience language.",
    ];
    return proposal;
  }

  if (editorialSource) {
    proposal.sourceGroup =
      "media";
    proposal.authorIdentity =
      "journalist";
    proposal.communicationIntent =
      "news_reporting";
    proposal.publicationArchetype =
      row.platform
        .toLowerCase()
        .includes("print")
        ? "news_article"
        : row.publication_archetype_silver;
    proposal.evidenceClass =
      "consumer_news";
    proposal.commercialIntent =
      "none";
    proposal.isPromotional =
      "no";
    proposal.disposition =
      "proposed_correction";
    proposal.confidence =
      "medium";
    proposal.reasons = [
      "The source identifies itself as an editorial or news publication.",
    ];
    return proposal;
  }

  return proposal;
}

export function buildMedicalAestheticsHighPriorityReview(
  labels:
    MedicalAestheticsEvidenceLabel[]
): MedicalAestheticsReviewRow[] {
  const rows = labels
    .filter(
      (row) =>
        row.review_priority ===
        "high"
    )
    .map((row) => ({
      row,
      proposal:
        reviewLabel(row),
    }))
    .sort((left, right) => {
      const order = {
        proposed_correction: 0,
        proposed_confirmation: 1,
        unresolved: 2,
      };
      return (
        order[
          left.proposal
            .disposition
        ] -
          order[
            right.proposal
              .disposition
          ] ||
        left.row.document_id.localeCompare(
          right.row.document_id
        )
      );
    });

  return rows.map(
    ({ row, proposal }, index) => ({
      review_order:
        String(index + 1),
      document_id:
        row.document_id,
      source_url:
        row.source_url,
      source_name:
        row.source_name,
      author_name:
        row.author_name,
      author_handle:
        row.author_handle,
      title: row.title,
      excerpt: row.excerpt,
      published_at:
        row.published_at,
      country: row.country,
      platform: row.platform,
      theme_ids_silver:
        row.theme_ids_silver,
      silver_source_group:
        row.source_group_silver,
      silver_author_identity:
        row.author_identity_silver,
      silver_communication_intent:
        row.communication_intent_silver,
      silver_publication_archetype:
        row.publication_archetype_silver,
      silver_evidence_class:
        row.evidence_class_silver,
      silver_commercial_intent:
        row.commercial_intent_silver,
      silver_is_promotional:
        row.is_promotional_silver,
      silver_relevance:
        row.medical_aesthetics_relevance_silver,
      ai_review_source_group:
        proposal.sourceGroup,
      ai_review_author_identity:
        proposal.authorIdentity,
      ai_review_communication_intent:
        proposal.communicationIntent,
      ai_review_publication_archetype:
        proposal.publicationArchetype,
      ai_review_evidence_class:
        proposal.evidenceClass,
      ai_review_commercial_intent:
        proposal.commercialIntent,
      ai_review_is_promotional:
        proposal.isPromotional,
      ai_review_relevance:
        proposal.relevance,
      ai_review_disposition:
        proposal.disposition,
      ai_review_confidence:
        proposal.confidence,
      ai_review_reason:
        proposal.reasons.join(
          " | "
        ),
      review_version:
        MEDICAL_AESTHETICS_REVIEW_VERSION,
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
      reviewer_confidence:
        "",
      reviewer_id: "",
      adjudication_status:
        "ai_reviewed_pending_human",
      notes: "",
    })
  );
}

function csvCell(value: string) {
  return `"${value.replace(
    /"/g,
    '""'
  )}"`;
}

export function serializeMedicalAestheticsHighPriorityReview(
  rows:
    MedicalAestheticsReviewRow[]
) {
  return [
    MEDICAL_AESTHETICS_REVIEW_COLUMNS.map(
      csvCell
    ).join(","),
    ...rows.map((row) =>
      MEDICAL_AESTHETICS_REVIEW_COLUMNS.map(
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

export function summarizeMedicalAestheticsHighPriorityReview(
  rows:
    MedicalAestheticsReviewRow[]
) {
  const dispositions:
    Record<string, number> = {};
  const confidences:
    Record<string, number> = {};
  const proposedSourceGroups:
    Record<string, number> = {};
  let proposedPromotionalCount =
    0;
  let proposedNotRelevantCount =
    0;

  for (const row of rows) {
    increment(
      dispositions,
      row.ai_review_disposition
    );
    increment(
      confidences,
      row.ai_review_confidence
    );
    increment(
      proposedSourceGroups,
      row.ai_review_source_group
    );
    if (
      row.ai_review_is_promotional ===
      "yes"
    ) {
      proposedPromotionalCount +=
        1;
    }
    if (
      row.ai_review_relevance ===
      "not_relevant"
    ) {
      proposedNotRelevantCount +=
        1;
    }
  }

  return {
    reviewVersion:
      MEDICAL_AESTHETICS_REVIEW_VERSION,
    rowCount: rows.length,
    dispositions,
    confidences,
    proposedSourceGroups,
    proposedPromotionalCount,
    proposedNotRelevantCount,
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
