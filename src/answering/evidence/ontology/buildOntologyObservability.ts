import type {
  CanonicalFinding,
} from "../../models/finding";
import type {
  EvidenceOntology,
  OntologyPublicationArchetype,
  PlatformAwareSocialArchetypeResult,
} from "./types";
import {
  ALL_ONTOLOGY_PUBLICATION_ARCHETYPES,
  ALL_PLATFORM_FAMILIES,
  ALL_VOICE_ORIGIN_TYPES,
  type VoiceOriginType,
} from "./observabilityCatalog";

export type OntologyConfidenceBand =
  | "very_high"
  | "high"
  | "moderate"
  | "low"
  | "very_low"
  | "missing";

export type OntologyObservability = {
  totalFindings: number;

  findingsWithOntology: number;

  findingsWithoutOntology: number;

  publicationArchetypeCounts: Record<
    OntologyPublicationArchetype,
    number
  >;

  platformFamilyCounts: Record<
    PlatformAwareSocialArchetypeResult["platformFamily"],
    number
  >;

  voiceOriginCounts: Record<
    VoiceOriginType,
    number
  >;

  confidenceBandCounts: Record<
    OntologyConfidenceBand,
    number
  >;

  publicationArchetypeByPlatformFamily: Record<
    PlatformAwareSocialArchetypeResult["platformFamily"],
    Record<OntologyPublicationArchetype, number>
  >;

  publicationArchetypeByContentType: Record<
    string,
    Record<OntologyPublicationArchetype, number>
  >;

  publicationArchetypeAverageConfidence: Record<
    OntologyPublicationArchetype,
    number
  >;

  unknownArchetypeByPlatformFamily: Record<
    PlatformAwareSocialArchetypeResult["platformFamily"],
    number
  >;

  secondaryVoiceArchetypeCounts: Record<
    OntologyPublicationArchetype,
    number
  >;
};

function createArchetypeCounts(): Record<
  OntologyPublicationArchetype,
  number
> {
  return Object.fromEntries(
    ALL_ONTOLOGY_PUBLICATION_ARCHETYPES.map(
      (archetype) => [
        archetype,
        0,
      ]
    )
  ) as Record<
    OntologyPublicationArchetype,
    number
  >;
}

function createPlatformFamilyCounts(): Record<
  PlatformAwareSocialArchetypeResult["platformFamily"],
  number
> {
  return Object.fromEntries(
    ALL_PLATFORM_FAMILIES.map(
      (platformFamily) => [
        platformFamily,
        0,
      ]
    )
  ) as Record<
    PlatformAwareSocialArchetypeResult["platformFamily"],
    number
  >;
}

function createVoiceOriginCounts(): Record<
  VoiceOriginType,
  number
> {
  return Object.fromEntries(
    ALL_VOICE_ORIGIN_TYPES.map(
      (voiceOrigin) => [
        voiceOrigin,
        0,
      ]
    )
  ) as Record<
    VoiceOriginType,
    number
  >;
}

function createConfidenceBandCounts(): Record<
  OntologyConfidenceBand,
  number
> {
  return {
    very_high: 0,
    high: 0,
    moderate: 0,
    low: 0,
    very_low: 0,
    missing: 0,
  };
}

function createPlatformArchetypeMatrix(): Record<
  PlatformAwareSocialArchetypeResult["platformFamily"],
  Record<OntologyPublicationArchetype, number>
> {
  return Object.fromEntries(
    ALL_PLATFORM_FAMILIES.map(
      (platformFamily) => [
        platformFamily,
        createArchetypeCounts(),
      ]
    )
  ) as Record<
    PlatformAwareSocialArchetypeResult["platformFamily"],
    Record<OntologyPublicationArchetype, number>
  >;
}

function normalizeContentType(
  value: unknown
): string {
  const normalized = String(
    value || "unknown"
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "unknown";
}

function getConfidenceBand(
  value: unknown
): OntologyConfidenceBand {
  const confidence =
    Number(value);

  if (
    !Number.isFinite(
      confidence
    )
  ) {
    return "missing";
  }

  if (confidence >= 0.8) {
    return "very_high";
  }

  if (confidence >= 0.65) {
    return "high";
  }

  if (confidence >= 0.5) {
    return "moderate";
  }

  if (confidence >= 0.35) {
    return "low";
  }

  return "very_low";
}

function isPublicationArchetype(
  value: unknown
): value is OntologyPublicationArchetype {
  return ALL_ONTOLOGY_PUBLICATION_ARCHETYPES.includes(
    value as OntologyPublicationArchetype
  );
}

function isPlatformFamily(
  value: unknown
): value is PlatformAwareSocialArchetypeResult["platformFamily"] {
  return ALL_PLATFORM_FAMILIES.includes(
    value as PlatformAwareSocialArchetypeResult["platformFamily"]
  );
}

function getOntology(
  finding: CanonicalFinding
): EvidenceOntology | undefined {
  return (
    finding as any
  ).evidenceIntelligence
    ?.ontology;
}

function getContentType(
  finding: CanonicalFinding
): string {
  const value =
    finding as any;

  return normalizeContentType(
    value
      .evidenceIntelligence
      ?.metadata
      ?.contentType ||
      value.contentType ||
      value.structuredData
        ?.contentType ||
      value.rawMetadata
        ?.normalizedFields
        ?.content_type
  );
}

export function buildOntologyObservability(
  findings: CanonicalFinding[]
): OntologyObservability {
  const publicationArchetypeCounts =
    createArchetypeCounts();

  const platformFamilyCounts =
    createPlatformFamilyCounts();

  const voiceOriginCounts =
    createVoiceOriginCounts();

  const confidenceBandCounts =
    createConfidenceBandCounts();

  const publicationArchetypeByPlatformFamily =
    createPlatformArchetypeMatrix();

  const publicationArchetypeByContentType: Record<
    string,
    Record<OntologyPublicationArchetype, number>
  > = {};

  const confidenceTotals =
    createArchetypeCounts();

  const confidenceSampleCounts =
    createArchetypeCounts();

  const unknownArchetypeByPlatformFamily =
    createPlatformFamilyCounts();

  const secondaryVoiceArchetypeCounts =
    createArchetypeCounts();

  let findingsWithOntology = 0;

  for (
    const finding of findings
  ) {
    const ontology =
      getOntology(finding);

    if (!ontology) {
      continue;
    }

    findingsWithOntology += 1;

    const archetype =
      isPublicationArchetype(
        ontology.publicationArchetype
      )
        ? ontology.publicationArchetype
        : "unknown";

    const platformFamily =
      isPlatformFamily(
        ontology.platformFamily
      )
        ? ontology.platformFamily
        : "not_social";

    const voiceOrigin: VoiceOriginType =
      ontology.isSecondaryVoice
        ? "secondary_voice"
        : "primary_voice";

    const confidenceBand =
      getConfidenceBand(
        ontology.publicationArchetypeConfidence
      );

    const contentType =
      getContentType(
        finding
      );

    publicationArchetypeCounts[
      archetype
    ] += 1;

    platformFamilyCounts[
      platformFamily
    ] += 1;

    voiceOriginCounts[
      voiceOrigin
    ] += 1;

    confidenceBandCounts[
      confidenceBand
    ] += 1;

    publicationArchetypeByPlatformFamily[
      platformFamily
    ][archetype] += 1;

    if (
      !publicationArchetypeByContentType[
        contentType
      ]
    ) {
      publicationArchetypeByContentType[
        contentType
      ] = createArchetypeCounts();
    }

    publicationArchetypeByContentType[
      contentType
    ][archetype] += 1;

    const confidence =
      Number(
        ontology.publicationArchetypeConfidence
      );

    if (
      Number.isFinite(
        confidence
      )
    ) {
      confidenceTotals[
        archetype
      ] += confidence;

      confidenceSampleCounts[
        archetype
      ] += 1;
    }

    if (
      archetype ===
      "unknown"
    ) {
      unknownArchetypeByPlatformFamily[
        platformFamily
      ] += 1;
    }

    if (
      ontology.isSecondaryVoice
    ) {
      secondaryVoiceArchetypeCounts[
        archetype
      ] += 1;
    }
  }

  const publicationArchetypeAverageConfidence =
    Object.fromEntries(
      ALL_ONTOLOGY_PUBLICATION_ARCHETYPES.map(
        (archetype) => {
          const sampleCount =
            confidenceSampleCounts[
              archetype
            ];

          const average =
            sampleCount > 0
              ? confidenceTotals[
                  archetype
                ] /
                sampleCount
              : 0;

          return [
            archetype,
            Number(
              average.toFixed(
                2
              )
            ),
          ];
        }
      )
    ) as Record<
      OntologyPublicationArchetype,
      number
    >;

  return {
    totalFindings:
      findings.length,

    findingsWithOntology,

    findingsWithoutOntology:
      findings.length -
      findingsWithOntology,

    publicationArchetypeCounts,

    platformFamilyCounts,

    voiceOriginCounts,

    confidenceBandCounts,

    publicationArchetypeByPlatformFamily,

    publicationArchetypeByContentType,

    publicationArchetypeAverageConfidence,

    unknownArchetypeByPlatformFamily,

    secondaryVoiceArchetypeCounts,
  };
}