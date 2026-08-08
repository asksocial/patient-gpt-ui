import type {
  PvClassification,
  PvConceptMatch,
  PvContentInput,
  PvDetectionConcept,
  PvDetectionResult,
} from "./types";
import { extractPvAdverseEventOntology } from "./ontology";

export const PV_CLASSIFIER_VERSION = "pv-context-rules-1.1.0";

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
}
function activeOn(concept: PvDetectionConcept, at: string) {
  if (!concept.active) return false;
  const time = new Date(at).getTime();
  if (concept.activeFrom && time < new Date(concept.activeFrom).getTime()) return false;
  if (concept.activeUntil && time > new Date(concept.activeUntil).getTime()) return false;
  return true;
}

function classificationFor(category: PvDetectionConcept["category"]): PvClassification | undefined {
  const mapping: Partial<Record<PvDetectionConcept["category"], PvClassification>> = {
    adverse_experience: "adverse_event",
    product_quality: "product_quality_complaint",
    pregnancy: "pregnancy",
    medication_error: "medication_error",
    lack_of_efficacy: "lack_of_efficacy",
    overdose: "overdose",
    misuse_abuse: "misuse_abuse",
  };
  return mapping[category];
}

function findMatches(content: PvContentInput, concepts: PvDetectionConcept[]) {
  const text = normalize([content.verbatim, content.parentContext || "", ...(content.threadContext || [])].join(" "));
  const matches: PvConceptMatch[] = [];
  const exclusions = new Set<string>();

  for (const concept of concepts) {
    if (!activeOn(concept, content.postedAt)) continue;
    if (concept.language && content.language && concept.language !== content.language) continue;
    if (concept.market && content.market && concept.market !== content.market) continue;
    const exclusion = (concept.exclusions || []).find((term) => text.includes(normalize(term)));
    if (exclusion) {
      exclusions.add(exclusion);
      continue;
    }
    const matchedTerm = concept.terms.find((term) => text.includes(normalize(term)));
    if (matchedTerm) {
      matches.push({
        conceptId: concept.id,
        category: concept.category,
        canonicalTerm: concept.canonicalTerm,
        matchedTerm,
        weight: Math.max(0, Math.min(100, concept.weight)),
      });
    }
  }

  return { matches, exclusions: [...exclusions] };
}

export function classifyPvContent(
  content: PvContentInput,
  concepts: PvDetectionConcept[],
  options: { threshold?: number; libraryVersion?: number; expectedEvents?: string[] } = {}
): PvDetectionResult {
  if (!content.externalId.trim() || !content.verbatim.trim() || !content.sourceUrl.trim()) {
    throw new Error("External ID, original verbatim, and source URL are required.");
  }
  if (Number.isNaN(new Date(content.postedAt).getTime())) throw new Error("A valid post timestamp is required.");

  const { matches, exclusions } = findMatches(content, concepts);
  const ontologyExtraction = extractPvAdverseEventOntology(content, matches, {
    expectedEvents: options.expectedEvents,
  });
  const productMatches = matches.filter((match) => match.category === "product");
  const healthMatches = matches.filter((match) => !["product", "severity", "treatment_change"].includes(match.category));
  const contextMatches = matches.filter((match) => ["severity", "treatment_change"].includes(match.category));
  const productConfidence = Math.min(100, productMatches.reduce((sum, match) => sum + match.weight, 0));
  const healthExperienceConfidence = Math.min(100, healthMatches.reduce((sum, match) => sum + match.weight, 0));
  const conceptContextConfidence = Math.min(100, contextMatches.reduce((sum, match) => sum + match.weight, 0));
  const ontologyContextConfidence = ontologyExtraction.seriousness.value === "serious" ? 100
    : ontologyExtraction.severity.value === "severe" ? 80
      : ontologyExtraction.outcomes.some((outcome) => outcome.category === "hospitalization" || outcome.category === "permanent_injury" || outcome.category === "fatal") ? 100 : 0;
  const contextConfidence = Math.max(conceptContextConfidence, ontologyContextConfidence);
  const score = Math.round(
    productConfidence * 0.4 + healthExperienceConfidence * 0.45 + contextConfidence * 0.15
  );
  const threshold = Math.max(1, Math.min(100, options.threshold ?? 55));
  const classifications = [...new Set(healthMatches.map((match) => classificationFor(match.category)).filter(Boolean))] as PvClassification[];
  const shouldCreateRecord = productConfidence > 0 && healthExperienceConfidence > 0 && score >= threshold;
  const rationale = [
    productConfidence > 0 ? `Product reference supported by ${productMatches.length} configured concept match(es).` : "No configured product reference was detected.",
    healthExperienceConfidence > 0 ? `Potential health experience or special situation supported by ${healthMatches.length} match(es).` : "No health experience or special situation was detected.",
    contextConfidence > 0 ? `Seriousness, severity, outcome, or treatment-change context increased priority by ${contextConfidence} confidence points.` : "No additional seriousness, severity, outcome, or treatment-change context was detected.",
    shouldCreateRecord ? "Content requires human PV review; this is not an adverse-event determination." : "Content remains retained as a detection audit result and is not routed to the review queue.",
  ];

  return {
    shouldCreateRecord,
    score,
    productConfidence,
    healthExperienceConfidence,
    contextConfidence,
    classifications,
    matches,
    exclusions,
    rationale,
    classifierVersion: PV_CLASSIFIER_VERSION,
    detectionLibraryVersion: options.libraryVersion ?? Math.max(0, ...concepts.map((concept) => concept.version)),
    ontologyExtraction,
  };
}
