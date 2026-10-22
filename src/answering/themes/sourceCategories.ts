import type { EvidenceSourceCategory } from "./themeModels";

export const INDEPENDENT_SOURCE_CATEGORIES: ReadonlySet<EvidenceSourceCategory> =
  new Set<EvidenceSourceCategory>([
    "first_person",
    "caregiver_voice",
    "provider_voice",
    "community_voice",
    "research_or_science",
    "independent_editorial",
  ]);

