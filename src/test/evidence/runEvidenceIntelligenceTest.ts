import { CanonicalFinding } from "../../answering/models/finding";
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
    findingId: params.id,
    findingType: "market_interest",
    canonicalClaim: params.summary,

    countries: [],
    personas: params.persona
      ? [params.persona]
      : [],
    platforms: [params.platform],

    symptoms: [],
    treatments: [],
    lifecycleStages: [],
    intentLabels: [],

    confidence: 0.85,
    relevanceScore: 0.8,
    evidenceStrength: 0.8,

    evidence: [],
    normalizedLabels: [],
    semanticFingerprint: params.id,
    structuredData: {},

    title: params.title,
    summary: params.summary,
    platform: params.platform,
    persona: params.persona,
    url: params.url,
    sourceType: "live",
  } as unknown as CanonicalFinding;
}

const findings = [
  createFinding({
    id: "reddit-patient",
    title: "My treatment experience",
    summary:
      "As a patient, I received the treatment six months ago and noticed gradual improvement in my symptoms.",
    platform: "Forum",
    url:
      "https://www.reddit.com/r/test/comments/123",
    persona: "patient",
  }),

  createFinding({
    id: "consumer-news-i-tried",
    title: "I tried a popular treatment",
    summary:
      "I tried the treatment for three weeks. According to experts, the results vary.",
    platform: "Online News",
    url:
      "https://example-news.com/i-tried-treatment",
    persona: "patient",
  }),

  createFinding({
    id: "provider-blog",
    title: "Treatment planning in practice",
    summary:
      "As a physician, I assess every patient individually. In my practice, treatment planning is based on patient selection and clinical outcomes.",
    platform: "Blog",
    url:
      "https://exampledoctor.com/treatment-planning",
    persona: "provider",
  }),

  createFinding({
    id: "press-release",
    title: "Company announces new platform",
    summary:
      "The company announced today through PR Newswire that it has launched a new platform.",
    platform: "Online News",
    url:
      "https://www.prnewswire.com/news-releases/example",
  }),

  createFinding({
    id: "pubmed-paper",
    title: "Randomized clinical study",
    summary:
      "Methods: participants were randomized. Results showed statistically significant improvement.",
    platform: "Research",
    url:
      "https://pubmed.ncbi.nlm.nih.gov/12345678/",
  }),

  createFinding({
    id: "clinic-ad",
    title: "Book your consultation",
    summary:
      "Book now for a free consultation. Contact us today and schedule your appointment.",
    platform: "Social Network",
    url:
      "https://exampleclinic.com/book-now",
  }),
];

const enriched =
  enrichFindingsWithEvidenceIntelligence(
    findings
  );

console.log(
  JSON.stringify(
    enriched.map((finding: any) => ({
      findingId: finding.findingId,
      title: finding.title,
      evidenceIntelligence:
        finding.evidenceIntelligence,
    })),
    null,
    2
  )
);
