import type { CanonicalFinding } from "../answering/models/finding";
import {
  buildPatientEvidenceCatalog,
  buildPatientIntelligence,
  type PatientEvidenceDimension,
} from "../lib/patient-intelligence/buildPatientIntelligence";

function finding(id: string, text: string, treatments: string[] = []): CanonicalFinding {
  return {
    findingId: id, findingType: "treatment_journey", canonicalClaim: text, summary: text,
    therapeuticArea: "Medical Aesthetics", countries: ["US"], personas: ["patient"], platforms: ["Reddit"],
    symptoms: [], treatments, lifecycleStages: [], intentLabels: [], confidence: 0.8, relevanceScore: 0.8,
    evidenceStrength: 0.8, evidence: [{ sourceType: "live", sourceId: id, excerpt: text, platform: "Reddit", url: `https://example.com/${id}` }],
    normalizedLabels: ["patient"], semanticFingerprint: id,
  };
}

const result = buildPatientIntelligence("Medical Aesthetics", [
  finding("1", "I am thinking about filler but I am worried it could look overdone.", ["filler"]),
  finding("2", "I got filler and regret it. Can I dissolve it?", ["filler"]),
  finding("3", "Should I ask my provider whether this is safe?", ["filler"]),
], "2026-07-31T12:00:00.000Z");

if (result.schemaVersion !== "patient_intelligence_v1") throw new Error("Patient Intelligence schema is missing.");
if (!result.treatmentBarriers.some((item) => item.id === "trust_safety")) throw new Error("Safety barriers were not detected.");
if (!result.journeyStages.some((item) => item.id === "consideration")) throw new Error("Journey consideration was not detected.");
if (!result.evidence.every((item) => item.findingId && item.fullMention && item.matchedSignalLabels.length)) {
  throw new Error("Representative patient outputs must retain provenance and full-mention context.");
}
if (!result.dataQuality.limitations.length) throw new Error("Data limitations must be disclosed.");

const dimensions: PatientEvidenceDimension[] = [
  "journey",
  "treatment_barriers",
  "emotional_burden",
  "unmet_needs",
];
for (const dimension of dimensions) {
  const summary = result.evidenceDimensions.find((item) => item.id === dimension);
  if (!summary) throw new Error(`Patient evidence dimension ${dimension} is missing.`);
  const catalog = buildPatientEvidenceCatalog("Medical Aesthetics", [
    finding("1", "I am thinking about filler but I am worried it could look overdone.", ["filler"]),
    finding("2", "I got filler and regret it. Can I dissolve it?", ["filler"]),
    finding("3", "Should I ask my provider whether this is safe?", ["filler"]),
  ], dimension);
  if (catalog.total !== summary.findingCount) {
    throw new Error(`Patient evidence count for ${dimension} does not match its full catalog.`);
  }
  if (new Set(catalog.items.map((item) => item.findingId)).size !== catalog.items.length) {
    throw new Error(`Patient evidence catalog for ${dimension} contains duplicate mentions.`);
  }
  if (catalog.items.some((item) => !item.fullMention || !item.matchedSignalLabels.length)) {
    throw new Error(`Patient evidence catalog for ${dimension} is missing full mention context.`);
  }
}

const searched = buildPatientEvidenceCatalog("Medical Aesthetics", [
  finding("1", "I am thinking about filler but I am worried it could look overdone.", ["filler"]),
  finding("2", "I got filler and regret it. Can I dissolve it?", ["filler"]),
  finding("3", "Should I ask my provider whether this is safe?", ["filler"]),
], "treatment_barriers", { query: "provider" });
if (searched.total !== 1 || searched.items[0]?.findingId !== "3") {
  throw new Error("Patient evidence search must filter the complete dimension catalog.");
}

console.log("Patient Intelligence product quality checks passed.");
