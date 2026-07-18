import type {
  EvidenceSourceCategory,
} from "./themeModels";

export const EVIDENCE_SOURCE_WEIGHTS: Record<
  EvidenceSourceCategory,
  number
> = {
  /**
   * Highest-value direct audience and clinical voices.
   */
  first_person: 24,
  caregiver_voice: 22,
  provider_voice: 24,

  /**
   * Recovered authentic social discussion where the
   * specific patient, caregiver, or provider identity
   * cannot be established confidently.
   */
  community_voice: 14,

  /**
   * Authoritative and independent contextual evidence.
   */
  research_or_science: 22,
  independent_editorial: 10,

  /**
   * Unknown content should not receive a meaningful
   * source-quality boost.
   */
  unknown: 0,

  /**
   * Lower-value or potentially commercially influenced
   * evidence categories.
   */
  event_or_conference: -8,
  brand_owned: -18,
  clinic_marketing: -24,
  press_release: -22,
  retail_or_product: -28,
};

export function getEvidenceSourceWeight(
  category: EvidenceSourceCategory
): number {
  return (
    EVIDENCE_SOURCE_WEIGHTS[
      category
    ] ?? 0
  );
}