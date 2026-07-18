import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  enrichFindingsWithEvidenceIntelligence,
} from "../../answering/evidence";

function createFinding(params: {
  id: string;
  title: string;
  summary: string;
  platform: string;
  url: string;
  persona?: string;
}): CanonicalFinding {
  return {
    findingId:
      params.id,

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

    confidence: 0.85,

    relevanceScore: 0.85,

    evidenceStrength: 0.85,

    evidence: [],

    normalizedLabels: [],

    semanticFingerprint:
      params.id,

    structuredData: {
      title:
        params.title,

      summary:
        params.summary,

      platform:
        params.platform,

      persona:
        params.persona,

      url:
        params.url,

      sourceType:
        "live",
    },

    title:
      params.title,

    summary:
      params.summary,

    excerpt:
      params.summary,

    description:
      params.summary,

    text:
      params.summary,

    platform:
      params.platform,

    persona:
      params.persona,

    url:
      params.url,

    sourceType:
      "live",

    therapeuticArea:
      "ontology_test",
  } as unknown as CanonicalFinding;
}

const findings:
  CanonicalFinding[] = [
    createFinding({
      id:
        "patient-experience",

      title:
        "My PRF experience",

      summary:
        "I tried PRF under my eyes three months ago. I noticed less hollowness after my second treatment, although I had swelling for several days.",

      platform:
        "Social Network",

      url:
        "https://social.example.com/patient",
    }),

    createFinding({
      id:
        "community-question",

      title:
        "Has anyone tried PDRN?",

      summary:
        "Has anyone tried PDRN for skin texture? I am considering it and would like to know what your experience was and whether it was worth it.",

      platform:
        "Social Network",

      url:
        "https://social.example.com/question",
    }),

    createFinding({
      id:
        "provider-education",

      title:
        "How collagen biostimulators work",

      summary:
        "As a dermatologist, I explain to my patients that collagen biostimulators work gradually. Patient selection and treatment planning are essential for natural results.",

      platform:
        "Social Network",

      url:
        "https://social.example.com/provider",

      persona:
        "provider",
    }),

    createFinding({
      id:
        "clinic-promotion",

      title:
        "Book your consultation",

      summary:
        "Our medspa is now offering Sculptra. Book your consultation today and contact us for pricing and appointment availability.",

      platform:
        "Social Network",

      url:
        "https://exampleclinic.com/sculptra",
    }),

    createFinding({
      id:
        "product-promotion",

      title:
        "PDRN serum",

      summary:
        "Our new PDRN serum contains powerful ingredients for brighter skin. Shop now, add to cart, and use our discount code for free shipping.",

      platform:
        "Social Network",

      url:
        "https://exampleproduct.com/pdrn",
    }),

    createFinding({
      id:
        "event-promotion",

      title:
        "Regenerative Aesthetics Summit",

      summary:
        "Join us at the upcoming Regenerative Aesthetics Summit. Register now to attend sessions on collagen stimulation, microneedling, and skin longevity.",

      platform:
        "Social Network",

      url:
        "https://exampleevent.com/summit",
    }),

    createFinding({
      id:
        "influencer",

      title:
        "My favorite new treatment",

      summary:
        "I was gifted this treatment through a paid partnership. Follow me, use my code, and check the link in bio for a discount.",

      platform:
        "Social Network",

      url:
        "https://social.example.com/influencer",
    }),

    createFinding({
      id:
        "research",

      title:
        "Randomized clinical trial",

      summary:
        "A peer-reviewed randomized clinical trial evaluated collagen stimulation and patient outcomes. Results showed statistically significant improvement.",

      platform:
        "Research",

      url:
        "https://pubmed.ncbi.nlm.nih.gov/12345678/",
    }),

    createFinding({
      id:
        "consumer-news",

      title:
        "Why regenerative aesthetics is growing",

      summary:
        "According to experts interviewed for this article, more patients are considering collagen-stimulating treatments and minimally invasive procedures.",

      platform:
        "Online News",

      url:
        "https://example-news.com/regenerative-aesthetics",
    }),
  ];

const enriched =
  enrichFindingsWithEvidenceIntelligence(
    findings
  );

const output =
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

      authorIdentity:
        finding
          .evidenceIntelligence
          ?.ontology
          ?.authorIdentity,

      communicationIntent:
        finding
          .evidenceIntelligence
          ?.ontology
          ?.communicationIntent,

      publicationArchetype:
        finding
          .evidenceIntelligence
          ?.ontology
          ?.publicationArchetype,

      authorityLevel:
        finding
          .evidenceIntelligence
          ?.ontology
          ?.authorityLevel,

      evidenceRole:
        finding
          .evidenceIntelligence
          ?.ontology
          ?.evidenceRole,

      ontologyConfidence:
        finding
          .evidenceIntelligence
          ?.ontology
          ?.overallConfidence,
    })
  );

console.log(
  JSON.stringify(
    output,
    null,
    2
  )
);

const byId = new Map(
  output.map((item) => [
    item.findingId,
    item,
  ])
);

function assertEqual(
  id: string,
  field: keyof typeof output[number],
  expected: string
): void {
  const actual =
    byId.get(id)?.[field];

  if (actual !== expected) {
    throw new Error(
      `${id}.${String(
        field
      )} expected "${expected}" but received "${String(
        actual
      )}"`
    );
  }
}

assertEqual(
  "patient-experience",
  "authorIdentity",
  "patient"
);

assertEqual(
  "patient-experience",
  "communicationIntent",
  "personal_experience"
);

assertEqual(
  "community-question",
  "communicationIntent",
  "community_question"
);

assertEqual(
  "provider-education",
  "authorIdentity",
  "provider"
);

assertEqual(
  "provider-education",
  "communicationIntent",
  "provider_education"
);

assertEqual(
  "clinic-promotion",
  "communicationIntent",
  "clinic_promotion"
);

assertEqual(
  "product-promotion",
  "communicationIntent",
  "product_promotion"
);

assertEqual(
  "event-promotion",
  "communicationIntent",
  "event_promotion"
);

assertEqual(
  "influencer",
  "authorIdentity",
  "influencer"
);

assertEqual(
  "research",
  "evidenceRole",
  "research_evidence"
);

assertEqual(
  "consumer-news",
  "communicationIntent",
  "news_reporting"
);