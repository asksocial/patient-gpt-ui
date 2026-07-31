import { buildCitationManifest } from "../lib/intelligence-platform/citations";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const manifest = buildCitationManifest([
  {
    themeId: "trust",
    label: "Trust",
    clientFacingEvidence: [{
      findingId: "finding-1",
      quote: "I asked my provider about the treatment.",
      claim: "Patients seek provider guidance.",
      sourceCategory: "social",
      selectionTier: "direct_voice",
      platform: "Reddit",
      url: "https://www.reddit.com/r/example/comments/1",
      themeRelevanceScore: 1,
      sourceCompatibilityScore: 1,
      qualityScore: 80,
      score: 80,
    }],
    representativeEvidence: [],
  } as any,
], [{ id: "curated-1", title: "Baseline report", evidence_excerpt: "Trust differs by market." }]);

assert(manifest.length === 2, "Manifest must include analytical and curated evidence.");
assert(manifest[0].traceability === "source_linked", "Valid source URLs must be linked.");
assert(manifest[0].verificationNote.includes("not been independently verified"), "Traceability must not overclaim authentication.");
assert(manifest[1].traceability === "context_only", "Curated evidence without a URL must be context only.");

console.log("Citation manifest quality checks passed.");
