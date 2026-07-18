import {
  DOMAIN_REGISTRY,
  domainMatches,
} from "../config/domainRegistry";
import {
  DomainCategory,
  DomainClassification,
  NormalizedEvidenceMetadata,
} from "../types";

const ORDERED_CATEGORIES: DomainCategory[] = [
  "press_release",
  "research",
  "government",
  "medical_society",
  "advocacy",
  "retail",
  "forum",
  "social",
  "video",
  "podcast",
  "healthcare_trade",
  "healthcare_news",
  "consumer_news",
  "blog",
];

export function classifyDomain(
  metadata: NormalizedEvidenceMetadata
): DomainClassification {
  const domain = metadata.domain;

  if (!domain) {
    return {
      category: "unknown",
      confidence: 0,
    };
  }

  for (const category of ORDERED_CATEGORIES) {
    const domains =
      DOMAIN_REGISTRY[category] || [];

    const match = domains.find(
      (registeredDomain) =>
        domainMatches(
          domain,
          registeredDomain
        )
    );

    if (match) {
      return {
        domain,
        category,
        confidence: 1,
        matchedRule: match,
      };
    }
  }

  const url =
    metadata.url?.toLowerCase() || "";

  if (
    url.includes("/press-release") ||
    url.includes("/press_release")
  ) {
    return {
      domain,
      category: "press_release",
      confidence: 0.85,
      matchedRule: "URL press-release path",
    };
  }

  if (
    domain.includes("clinic") ||
    domain.includes("medspa") ||
    domain.includes("medicalspa")
  ) {
    return {
      domain,
      category: "clinic",
      confidence: 0.65,
      matchedRule: "Clinic-like hostname",
    };
  }

  return {
    domain,
    category: "unknown",
    confidence: 0.25,
  };
}