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

    relevanceScore: 0.8,

    evidenceStrength: 0.8,

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

    platform:
      params.platform,

    persona:
      params.persona,

    url:
      params.url,

    sourceType: "live",

    therapeuticArea:
      "regenerative_aesthetics",
  } as unknown as CanonicalFinding;
}

const findings:
  CanonicalFinding[] = [
    createFinding({
      id:
        "implicit-patient",

      title:
        "Three months after treatment",

      summary:
        "I tried PRF under my eyes three months ago. I noticed less hollowness after the second session, although the swelling lasted several days.",

      platform:
        "Social Network",

      url:
        "https://social.example.com/post/1",
    }),

    createFinding({
      id:
        "community-question",

      title:
        "Has anyone tried PDRN?",

      summary:
        "Has anyone tried PDRN for skin texture? I am considering it but would like to know how long the results lasted and whether the recovery was difficult.",

      platform:
        "Social Network",

      url:
        "https://social.example.com/post/2",
    }),

    createFinding({
      id:
        "provider-discussion",

      title:
        "Patient selection for biostimulators",

      summary:
        "As a dermatologist, I assess each patient before recommending a collagen biostimulator. In my practice, patient selection and treatment planning are essential.",

      platform:
        "Social Network",

      url:
        "https://social.example.com/post/3",

      persona:
        "provider",
    }),

    createFinding({
      id:
        "clinic-promotion",

      title:
        "Book a treatment",

      summary:
        "Book now for regenerative aesthetics. Contact us today for a free consultation and special pricing.",

      platform:
        "Social Network",

      url:
        "https://exampleclinic.com/post/4",
    }),

    createFinding({
      id:
        "influencer-post",

      title:
        "My favorite new treatment",

      summary:
        "I was gifted this treatment. Follow me and use my code for a discount. Link in bio.",

      platform:
        "Social Network",

      url:
        "https://social.example.com/post/5",
    }),

    createFinding({
      id:
        "news-first-person",

      title:
        "I tried a viral treatment",

      summary:
        "I tried the treatment for a month. According to experts, results vary depending on the patient.",

      platform:
        "Online News",

      url:
        "https://example-news.com/i-tried-treatment",
    }),
  ];

const enriched =
  enrichFindingsWithEvidenceIntelligence(
    findings
  );

const results =
  enriched.map(
    (finding: any) => ({
      findingId:
        finding.findingId,

      evidenceClass:
        finding
          .evidenceIntelligence
          ?.evidenceClass,

      voice:
        finding
          .evidenceIntelligence
          ?.voice,

      publicationType:
        finding
          .evidenceIntelligence
          ?.publicationType,

      socialAuthenticityScore:
        finding
          .evidenceIntelligence
          ?.socialAuthenticityScore,

      isAuthenticConversation:
        finding
          .evidenceIntelligence
          ?.isAuthenticConversation,

      qualityScore:
        finding
          .evidenceIntelligence
          ?.qualityScore,

      commercialIntent:
        finding
          .evidenceIntelligence
          ?.commercialIntent,
    })
  );

console.log(
  JSON.stringify(
    results,
    null,
    2
  )
);

const byId = new Map(
  results.map((result) => [
    result.findingId,
    result,
  ])
);

if (
  byId.get(
    "implicit-patient"
  )?.evidenceClass !==
  "patient_conversation"
) {
  throw new Error(
    "Implicit patient experience was not recovered."
  );
}

if (
  byId.get(
    "community-question"
  )?.evidenceClass !==
  "community_conversation"
) {
  throw new Error(
    "Community discussion was not recovered."
  );
}

if (
  byId.get(
    "provider-discussion"
  )?.evidenceClass !==
  "provider_conversation"
) {
  throw new Error(
    "Provider conversation was not classified correctly."
  );
}

if (
  ![
    "clinic_marketing",
    "sponsored_content",
  ].includes(
    String(
      byId.get(
        "clinic-promotion"
      )?.evidenceClass
    )
  )
) {
  throw new Error(
    "Clinic promotion was not suppressed."
  );
}

if (
  byId.get(
    "influencer-post"
  )?.evidenceClass !==
  "influencer_content"
) {
  throw new Error(
    "Influencer content was not classified correctly."
  );
}

if (
  byId.get(
    "news-first-person"
  )?.evidenceClass !==
  "consumer_news"
) {
  throw new Error(
    "News article was incorrectly treated as social conversation."
  );
}