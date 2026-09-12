import { DiseaseProfile } from "./types";

import { hepatitisBProfile } from "./hepatitisBProfile";
import { uterineFibroidsProfile } from "./uterineFibroidsProfile";
import { geneTherapyProfile } from "./geneTherapyProfile";
import { regenerativeAestheticsProfile } from "./regenerativeAestheticsProfile";
import { medicalAestheticsProfile } from "./medicalAestheticsProfile";
import { botulinumToxinProfile } from "./botulinumToxinProfile";
import { createGenericTherapeuticAreaProfile } from "./genericTherapeuticAreaProfile";

export const DISEASE_PROFILES: Record<string, DiseaseProfile> = {
  hepatitis_b: hepatitisBProfile,
  uterine_fibroids: uterineFibroidsProfile,
  gene_therapy: geneTherapyProfile,
  regenerative_aesthetics: regenerativeAestheticsProfile,
  medical_aesthetics: medicalAestheticsProfile,
  botulinum_toxin: botulinumToxinProfile,
};

export function getDiseaseProfile(
  profileId: string,
  therapeuticArea?: string
): DiseaseProfile {
  const profile = DISEASE_PROFILES[profileId];

  return profile || createGenericTherapeuticAreaProfile(profileId, therapeuticArea);
}

export type { DiseaseProfile } from "./types";
