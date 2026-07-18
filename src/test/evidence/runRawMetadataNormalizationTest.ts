import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  analyzeEvidence,
  normalizeEvidenceMetadata,
} from "../../answering/evidence";
import {
  preserveRawMetadata,
} from "../../ingestion/metadata";

const rawMetadata =
  preserveRawMetadata(
    {
      "Document ID":
        "provider-test-1",

      "Title":
        "How collagen biostimulators work",

      "Opening Text":
        "Patient selection and treatment planning are important when choosing a collagen biostimulator.",

      "Hit Sentence":
        "In my practice, I explain that results develop gradually.",

      "Author Name":
        "Dr. Jane Smith",

      "Author Handle":
        "@drjanesmith",

      "Author Bio":
        "Board-certified dermatologist and medical director",

      "Source Type":
        "Social Network",

      "Content Type":
        "Social Post",

      "Source Name":
        "Instagram",

      "Country":
        "United States",

      "Date":
        "2026-07-15",

      "Time":
        "13:30:00",

      "Reach":
        "12500",

      "Document Tags":
        "collagen; aesthetics; skin quality",

      "URL":
        "https://instagram.example.com/post/1",
    },
    {
      adapter:
        "meltwater",

      sourceProvider:
        "meltwater",
    }
  );

const finding = {
  findingId:
    "provider-test-1",

  findingType:
    "market_interest",

  canonicalClaim:
    "Provider explains collagen biostimulation.",

  summary:
    "Provider explains collagen biostimulation.",

  therapeuticArea:
    "regenerative_aesthetics",

  countries: [],

  personas: [],

  platforms: [],

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
    "provider-test-1",

  rawMetadata,
} as CanonicalFinding;

const normalized =
  normalizeEvidenceMetadata(
    finding
  );

const intelligence =
  analyzeEvidence(
    finding
  );

console.log(
  JSON.stringify(
    {
      normalized,

      authorVoice:
        intelligence.voice,

      evidenceClass:
        intelligence.evidenceClass,

      ontology:
        intelligence.ontology,
    },
    null,
    2
  )
);

if (
  normalized.author !==
  "Dr. Jane Smith"
) {
  throw new Error(
    "Author Name was not normalized."
  );
}

if (
  normalized.authorHandle !==
  "@drjanesmith"
) {
  throw new Error(
    "Author Handle was not normalized."
  );
}

if (
  normalized.authorBio !==
  "Board-certified dermatologist and medical director"
) {
  throw new Error(
    "Author Bio was not normalized."
  );
}

if (
  normalized.normalizedPlatform !==
  "social"
) {
  throw new Error(
    "Source Type was not normalized as social."
  );
}

if (
  normalized.reach !==
  12500
) {
  throw new Error(
    "Reach was not normalized."
  );
}

if (
  intelligence.voice !==
  "provider"
) {
  throw new Error(
    `Expected provider voice but received ${intelligence.voice}.`
  );
}

if (
  intelligence.evidenceClass !==
  "provider_conversation"
) {
  throw new Error(
    `Expected provider_conversation but received ${intelligence.evidenceClass}.`
  );
}