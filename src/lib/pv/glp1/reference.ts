import snapshot from "../../../../config/pv/glp-1/faers-reference-2026-10-20.json";
import { GLP1_PV_CONCEPTS } from "./detection";

export function getGlp1FaersReference() {
  return {
    ...snapshot,
    // Source PTs remain reference vocabulary. Unreviewed FAERS terms never
    // silently become active rules, and counts never define label expectedness.
    detectionLibraryVersion: "glp-1-pv-2026.01.0",
    conceptCount: GLP1_PV_CONCEPTS.length,
    observedConfiguredTerms: GLP1_PV_CONCEPTS.filter((concept) => concept.category !== "product").map((concept) => ({
      canonicalTerm: concept.canonicalTerm, category: concept.category,
      sourceTerms: snapshot.reactions.filter((reaction) => [concept.canonicalTerm, ...concept.terms].some((term) => term.toLowerCase() === reaction.term.toLowerCase())).map((reaction) => reaction.term),
    })),
  };
}
