import type { PvClassification, PvConceptMatch } from "./types";

export type PvDetectionSegment = "ae_adr" | "health_experience";

export type PvHealthExperienceTag =
  | "medication_error"
  | "overdose"
  | "misuse_abuse"
  | "pregnancy_exposure"
  | "lack_of_efficacy"
  | "product_quality_complaint"
  | "other_observation";

type SegmentablePvRecord = {
  proposed_classifications?: PvClassification[] | null;
  classifications?: PvClassification[] | null;
  matched_concepts?: PvConceptMatch[] | null;
  matches?: PvConceptMatch[] | null;
  ae_ontology?: { adverseEvents?: unknown[] } | null;
  ontologyExtraction?: { adverseEvents?: unknown[] } | null;
};

const HEALTH_TAG_BY_CLASSIFICATION: Partial<Record<PvClassification, PvHealthExperienceTag>> = {
  medication_error: "medication_error",
  overdose: "overdose",
  misuse_abuse: "misuse_abuse",
  pregnancy: "pregnancy_exposure",
  lack_of_efficacy: "lack_of_efficacy",
  product_quality_complaint: "product_quality_complaint",
  other: "other_observation",
};

const HEALTH_TAG_BY_CATEGORY: Partial<Record<PvConceptMatch["category"], PvHealthExperienceTag>> = {
  medication_error: "medication_error",
  overdose: "overdose",
  misuse_abuse: "misuse_abuse",
  pregnancy: "pregnancy_exposure",
  lack_of_efficacy: "lack_of_efficacy",
  product_quality: "product_quality_complaint",
};

function classificationsOf(record: SegmentablePvRecord) {
  return record.proposed_classifications || record.classifications || [];
}

function matchesOf(record: SegmentablePvRecord) {
  return record.matched_concepts || record.matches || [];
}

export function derivePvDetectionSegment(record: SegmentablePvRecord): PvDetectionSegment {
  const classifications = classificationsOf(record);
  const matches = matchesOf(record);
  const ontology = record.ae_ontology || record.ontologyExtraction;
  if (
    classifications.includes("adverse_event") ||
    matches.some((match) => match.category === "adverse_experience") ||
    Boolean(ontology?.adverseEvents?.length)
  ) return "ae_adr";
  if (classifications.length || matches.length) return "health_experience";
  // Records created before explicit segmentation remain in the governed review pathway.
  return "ae_adr";
}

export function derivePvHealthExperienceTags(record: SegmentablePvRecord): PvHealthExperienceTag[] {
  const tags = new Set<PvHealthExperienceTag>();
  for (const classification of classificationsOf(record)) {
    const tag = HEALTH_TAG_BY_CLASSIFICATION[classification];
    if (tag) tags.add(tag);
  }
  for (const match of matchesOf(record)) {
    const tag = HEALTH_TAG_BY_CATEGORY[match.category];
    if (tag) tags.add(tag);
  }
  if (derivePvDetectionSegment(record) === "health_experience" && !tags.size) tags.add("other_observation");
  return [...tags];
}
