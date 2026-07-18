import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  buildOntologyObservability,
  ALL_ONTOLOGY_PUBLICATION_ARCHETYPES,
  ALL_PLATFORM_FAMILIES,
} from "../../answering/evidence/ontology";

function createFinding(params: {
  id: string;
  publicationArchetype:
    | "educational_video"
    | "social_reply"
    | "social_repost";
  platformFamily:
    | "youtube"
    | "twitter";
  isSecondaryVoice: boolean;
  confidence: number;
  contentType: string;
}): CanonicalFinding {
  return {
    findingId:
      params.id,

    findingType:
      "market_interest",

    canonicalClaim:
      params.id,

    summary:
      params.id,

    therapeuticArea:
      "observability_test",

    countries: [],

    personas: [],

    platforms: [],

    symptoms: [],

    treatments: [],

    lifecycleStages: [],

    intentLabels: [],

    confidence:
      0.8,

    relevanceScore:
      0.8,

    evidenceStrength:
      0.8,

    evidence: [],

    normalizedLabels: [],

    semanticFingerprint:
      params.id,

    rawMetadata: {
      adapter:
        "test",

      sourceProvider:
        "test",

      fields: {
        "Content Type":
          params.contentType,
      },

      normalizedFields: {
        content_type:
          params.contentType,
      },

      fieldNames: [
        "Content Type",
      ],

      populatedFieldNames: [
        "Content Type",
      ],

      textFieldNames: [],

      authorFieldNames: [],

      engagementFieldNames: [],

      temporalFieldNames: [],

      urlFieldNames: [],

      fieldCount: 1,

      populatedFieldCount: 1,

      preservedAt:
        new Date().toISOString(),
    },

    evidenceIntelligence: {
      ontology: {
        publicationArchetype:
          params.publicationArchetype,

        platformFamily:
          params.platformFamily,

        isSecondaryVoice:
          params.isSecondaryVoice,

        publicationArchetypeConfidence:
          params.confidence,
      },
    },
  } as unknown as
    CanonicalFinding;
}

const findings = [
  createFinding({
    id:
      "youtube-education",

    publicationArchetype:
      "educational_video",

    platformFamily:
      "youtube",

    isSecondaryVoice:
      false,

    confidence:
      0.9,

    contentType:
      "Video",
  }),

  createFinding({
    id:
      "twitter-reply",

    publicationArchetype:
      "social_reply",

    platformFamily:
      "twitter",

    isSecondaryVoice:
      false,

    confidence:
      0.8,

    contentType:
      "Reply",
  }),

  createFinding({
    id:
      "twitter-repost",

    publicationArchetype:
      "social_repost",

    platformFamily:
      "twitter",

    isSecondaryVoice:
      true,

    confidence:
      0.95,

    contentType:
      "Repost",
  }),
];

const observability =
  buildOntologyObservability(
    findings
  );

console.log(
  JSON.stringify(
    observability,
    null,
    2
  )
);

for (
  const archetype of
    ALL_ONTOLOGY_PUBLICATION_ARCHETYPES
) {
  if (
    !(
      archetype in
      observability
        .publicationArchetypeCounts
    )
  ) {
    throw new Error(
      `Publication archetype ${archetype} is missing from observability output.`
    );
  }
}

for (
  const platformFamily of
    ALL_PLATFORM_FAMILIES
) {
  if (
    !(
      platformFamily in
      observability
        .platformFamilyCounts
    )
  ) {
    throw new Error(
      `Platform family ${platformFamily} is missing from observability output.`
    );
  }
}

if (
  observability
    .publicationArchetypeCounts
    .educational_video !== 1
) {
  throw new Error(
    "Educational video count is incorrect."
  );
}

if (
  observability
    .publicationArchetypeCounts
    .social_reply !== 1
) {
  throw new Error(
    "Social reply count is incorrect."
  );
}

if (
  observability
    .publicationArchetypeCounts
    .social_repost !== 1
) {
  throw new Error(
    "Social repost count is incorrect."
  );
}

if (
  observability
    .platformFamilyCounts
    .youtube !== 1
) {
  throw new Error(
    "YouTube platform-family count is incorrect."
  );
}

if (
  observability
    .platformFamilyCounts
    .twitter !== 2
) {
  throw new Error(
    "Twitter platform-family count is incorrect."
  );
}

if (
  observability
    .voiceOriginCounts
    .secondary_voice !== 1
) {
  throw new Error(
    "Secondary-voice count is incorrect."
  );
}

if (
  observability
    .secondaryVoiceArchetypeCounts
    .social_repost !== 1
) {
  throw new Error(
    "Secondary repost count is incorrect."
  );
}