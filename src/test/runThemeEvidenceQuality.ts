import type {
  CanonicalFinding,
} from "../answering/models/finding";
import type {
  ThemeDefinition,
} from "../answering/themes/themeModels";
import {
  selectRepresentativeEvidence,
} from "../answering/themes/selectRepresentativeEvidence";
import {
  filterClientFacingEvidence,
} from "../answering/themes/filterClientFacingEvidence";
import {
  enrichFindingsWithEvidenceIntelligence,
} from "../answering/evidence";

const theme: ThemeDefinition = {
  themeId:
    "evidence_hierarchy_test",

  label:
    "Evidence Hierarchy Test",

  description:
    "Validates direct voice, authoritative evidence, contextual evidence, and fallback ranking.",

  keywords: [
    "natural results",
    "clinical evidence",
    "patient experience",
    "treatment planning",
  ],

  preferredEvidenceClasses: [
    "patient_conversation",
    "provider_conversation",
    "research_journal",
    "clinical_study",
  ],

  allowedEvidenceClasses: [
    "patient_conversation",
    "caregiver_conversation",
    "provider_conversation",
    "research_journal",
    "clinical_study",
    "government_or_regulator",
    "medical_society",
    "advocacy_organization",
    "healthcare_trade_publication",
    "healthcare_news",
    "youtube_review",
    "forum",
    "podcast",
    "personal_blog",
    "consumer_news",
  ],

  excludedEvidenceClasses: [
    "corporate_pr",
    "clinic_marketing",
    "retail_or_product",
    "sponsored_content",
    "influencer_content",
    "unknown",
  ],
};

function createTestFinding(params: {
  findingId: string;
  title: string;
  summary: string;
  platform: string;
  url: string;
  persona?: string;
  sourceType?: string;
}): CanonicalFinding {
  return {
    findingId:
      params.findingId,

    findingType:
      "market_interest",

    canonicalClaim:
      params.summary,

    countries: [
      "United States",
    ],

    personas:
      params.persona
        ? [params.persona]
        : [],

    platforms: [
      params.platform,
    ],

    symptoms: [],
    treatments: [],
    lifecycleStages: [],
    intentLabels: [],

    confidence: 0.9,
    relevanceScore: 0.85,
    evidenceStrength: 0.85,

    evidence: [],
    normalizedLabels: [],

    semanticFingerprint:
      params.findingId,

    structuredData: {
      title: params.title,
      summary: params.summary,
      platform: params.platform,
      persona: params.persona,
      url: params.url,
      sourceType:
        params.sourceType ||
        "live",
    },

    title: params.title,
    summary: params.summary,
    platform: params.platform,
    persona: params.persona,
    url: params.url,

    sourceType:
      params.sourceType ||
      "live",

    therapeuticArea:
      "test_new_area",
  } as unknown as CanonicalFinding;
}

const rawFindings:
  CanonicalFinding[] = [
    createTestFinding({
      findingId:
        "patient-voice",

      title:
        "My treatment experience",

      summary:
        "As a patient, I received the treatment because I wanted natural results. My experience has been positive and I noticed gradual improvement.",

      platform: "Forum",

      url:
        "https://www.reddit.com/r/test/comments/patient",

      persona: "patient",
    }),

    createTestFinding({
      findingId:
        "provider-voice",

      title:
        "Treatment planning in practice",

      summary:
        "As a physician, I assess every patient individually. In my practice, treatment planning focuses on natural results, patient selection, and clinical evidence.",

      platform: "Blog",

      url:
        "https://exampledoctor.com/treatment-planning",

      persona: "provider",
    }),

    createTestFinding({
      findingId: "research",

      title:
        "Randomized clinical study",

      summary:
        "A peer-reviewed randomized clinical study found that structured treatment planning was associated with natural results and improved patient satisfaction.",

      platform: "Research",

      url:
        "https://pubmed.ncbi.nlm.nih.gov/12345678/",

      persona: "researcher",

      sourceType: "curated",
    }),

    createTestFinding({
      findingId:
        "consumer-news",

      title:
        "I tried a popular aesthetic treatment",

      summary:
        "I tried the treatment for several weeks. According to experts, natural results depend on appropriate treatment planning.",

      platform:
        "Online News",

      url:
        "https://example-news.com/i-tried-treatment",

      persona: "patient",
    }),

    createTestFinding({
      findingId:
        "press-release",

      title:
        "Company announces new treatment platform",

      summary:
        "The company announced today through PR Newswire that its platform supports natural results and clinical evidence.",

      platform:
        "Online News",

      url:
        "https://www.prnewswire.com/news-releases/example",
    }),

    createTestFinding({
      findingId:
        "clinic-marketing",

      title:
        "Book your consultation",

      summary:
        "Book now for natural results. Contact us today for a free consultation and schedule your appointment.",

      platform:
        "Social Network",

      url:
        "https://exampleclinic.com/book-now",
    }),
  ];

const enriched =
  enrichFindingsWithEvidenceIntelligence(
    rawFindings
  );

const selection =
  selectRepresentativeEvidence(
    enriched,
    theme,
    {
      limit: 3,

      minimumRelevance: 0.25,

      maximumPerPlatform: 2,
      maximumPerSourceType: 3,
      maximumPerCountry: 3,
      maximumPerPersona: 2,

      minimumDirectVoiceEvidence:
        1,

      maximumAuthoritativeEvidence:
        2,

      maximumCredibleContextEvidence:
        1,

      maximumFallbackEvidence:
        1,

      maximumConsumerNewsEvidence:
        0,

      maximumUnknownEvidence:
        0,
    }
  );

const clientFacing =
  filterClientFacingEvidence(
    selection.evidence
  );

const assertions = {
  consumerNewsSelected:
    selection.evidence.some(
      (item) =>
        item.evidenceClass ===
        "consumer_news"
    ),

  promotionalSelected:
    selection.evidence.some(
      (item) =>
        [
          "corporate_pr",
          "clinic_marketing",
          "retail_or_product",
          "sponsored_content",
        ].includes(
          String(
            item.evidenceClass
          )
        )
    ),

  hasDirectVoice:
    selection.evidence.some(
      (item) =>
        [
          "patient_conversation",
          "provider_conversation",
          "caregiver_conversation",
        ].includes(
          String(
            item.evidenceClass
          )
        )
    ),

  hasAuthoritativeEvidence:
    selection.evidence.some(
      (item) =>
        [
          "research_journal",
          "clinical_study",
          "government_or_regulator",
          "medical_society",
        ].includes(
          String(
            item.evidenceClass
          )
        )
    ),
};

console.log(
  JSON.stringify(
    {
      classifications:
        enriched.map(
          (finding: any) => ({
            findingId:
              finding.findingId,

            evidenceClass:
              finding
                .evidenceIntelligence
                ?.evidenceClass,

            qualityScore:
              finding
                .evidenceIntelligence
                ?.qualityScore,

            qualityBand:
              finding
                .evidenceIntelligence
                ?.qualityBand,

            voice:
              finding
                .evidenceIntelligence
                ?.voice,
          })
        ),

      selected:
        selection.evidence.map(
          (item) => ({
            findingId:
              item.findingId,

            evidenceClass:
              item.evidenceClass,

            evidenceQualityScore:
              item.evidenceQualityScore,

            combinedQualityScore:
              item.qualityScore,

            selectionTier:
              item.selectionTier,
          })
        ),

      clientFacing:
        clientFacing.map(
          (item) => ({
            findingId:
              item.findingId,

            evidenceClass:
              item.evidenceClass,

            evidenceQualityScore:
              item.evidenceQualityScore,
          })
        ),

      diagnostics:
        selection.diagnostics,

      assertions,
    },
    null,
    2
  )
);

if (
  assertions.consumerNewsSelected
) {
  throw new Error(
    "Consumer news should not be selected."
  );
}

if (
  assertions.promotionalSelected
) {
  throw new Error(
    "Promotional evidence should not be selected."
  );
}

if (
  !assertions.hasDirectVoice
) {
  throw new Error(
    "Expected direct-voice evidence."
  );
}

if (
  !assertions.hasAuthoritativeEvidence
) {
  throw new Error(
    "Expected authoritative evidence."
  );
}