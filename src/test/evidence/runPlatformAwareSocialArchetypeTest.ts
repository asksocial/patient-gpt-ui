import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  enrichFindingsWithEvidenceIntelligence,
} from "../../answering/evidence";
import {
  preserveRawMetadata,
} from "../../ingestion/metadata";

function createFinding(params: {
  id: string;
  sourceName: string;
  contentType: string;
  title: string;
  text: string;
  authorName?: string;
  authorBio?: string;
}): CanonicalFinding {
  const rawMetadata =
    preserveRawMetadata(
      {
        "Document ID":
          params.id,

        "Source Type":
          "Social Network",

        "Source Name":
          params.sourceName,

        "Content Type":
          params.contentType,

        "Title":
          params.title,

        "Opening Text":
          params.text,

        "Hit Sentence":
          params.text,

        "Author Name":
          params.authorName ||
          "",

        "Author Bio":
          params.authorBio ||
          "",

        "URL":
          `https://example.com/${params.id}`,
      },
      {
        adapter:
          "meltwater",

        sourceProvider:
          "meltwater",
      }
    );

  return {
    findingId:
      params.id,

    findingType:
      "market_interest",

    canonicalClaim:
      params.text,

    summary:
      params.text,

    therapeuticArea:
      "platform_test",

    countries: [],

    personas: [],

    platforms: [
      "Social Network",
    ],

    symptoms: [],

    treatments: [],

    lifecycleStages: [],

    intentLabels: [],

    confidence:
      0.85,

    relevanceScore:
      0.85,

    evidenceStrength:
      0.85,

    evidence: [],

    normalizedLabels: [],

    semanticFingerprint:
      params.id,

    rawMetadata,
  } as CanonicalFinding;
}

const findings = [
  createFinding({
    id:
      "youtube-provider",

    sourceName:
      "Youtube",

    contentType:
      "Video",

    title:
      "How collagen biostimulators work",

    text:
      "As a dermatologist, I explain patient selection, treatment planning, and how collagen stimulation develops gradually.",

    authorName:
      "Dr. Jane Smith",

    authorBio:
      "Board-certified dermatologist and medical director",
  }),

  createFinding({
    id:
      "youtube-testimonial",

    sourceName:
      "Youtube",

    contentType:
      "Video",

    title:
      "My PRF experience",

    text:
      "I tried PRF three months ago. I noticed gradual improvement after my second treatment and had swelling for several days.",
  }),

  createFinding({
    id:
      "linkedin-brand",

    sourceName:
      "LinkedIn",

    contentType:
      "Social Post",

    title:
      "New aesthetics platform",

    text:
      "We are excited to announce our latest regenerative aesthetics platform and new clinical education program.",

    authorName:
      "Example Aesthetics Global",
  }),

  createFinding({
    id:
      "pinterest-product",

    sourceName:
      "Pinterest",

    contentType:
      "Social Post",

    title:
      "My skincare must haves",

    text:
      "Shop now for my favorite PDRN serum. Use my code and follow the link in bio for a discount.",
  }),

  createFinding({
    id:
      "twitter-reply",

    sourceName:
      "Twitter",

    contentType:
      "Reply",

    title:
      "Question about treatment",

    text:
      "Has anyone tried this treatment? Was the downtime difficult and was it worth it?",
  }),

  createFinding({
    id:
      "twitter-repost",

    sourceName:
      "Twitter",

    contentType:
      "Repost",

    title:
      "Reposted patient story",

    text:
      "I tried this treatment and loved my results.",
  }),
];

const enriched =
  enrichFindingsWithEvidenceIntelligence(
    findings
  ) as any[];

const output =
  enriched.map(
    (finding) => ({
      findingId:
        finding.findingId,

      evidenceClass:
        finding
          .evidenceIntelligence
          ?.evidenceClass,

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

      platformFamily:
        finding
          .evidenceIntelligence
          ?.ontology
          ?.platformFamily,

      isSecondaryVoice:
        finding
          .evidenceIntelligence
          ?.ontology
          ?.isSecondaryVoice,
    })
  );

console.log(
  JSON.stringify(
    output,
    null,
    2
  )
);

const byId =
  new Map(
    output.map(
      (item) => [
        item.findingId,
        item,
      ]
    )
  );

function assertValue(
  id: string,
  field:
    keyof typeof output[number],
  expected: unknown
): void {
  const actual =
    byId.get(id)?.[field];

  if (actual !== expected) {
    throw new Error(
      `${id}.${String(
        field
      )} expected ${String(
        expected
      )}, received ${String(
        actual
      )}`
    );
  }
}

assertValue(
  "youtube-provider",
  "publicationArchetype",
  "educational_video"
);

assertValue(
  "youtube-provider",
  "authorIdentity",
  "provider"
);

assertValue(
  "youtube-testimonial",
  "publicationArchetype",
  "testimonial_video"
);

assertValue(
  "linkedin-brand",
  "publicationArchetype",
  "brand_social_post"
);

assertValue(
  "pinterest-product",
  "publicationArchetype",
  "influencer_social_post"
);

assertValue(
  "twitter-reply",
  "publicationArchetype",
  "social_reply"
);

assertValue(
  "twitter-repost",
  "publicationArchetype",
  "social_repost"
);

assertValue(
  "twitter-repost",
  "isSecondaryVoice",
  true
);

if (
  byId.get(
    "twitter-repost"
  )?.evidenceClass ===
  "patient_conversation"
) {
  throw new Error(
    "Reposted first-person text must not be treated as primary patient voice."
  );
}