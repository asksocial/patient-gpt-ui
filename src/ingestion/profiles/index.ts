import { DiseaseProfile } from "./types";

import { hepatitisBProfile } from "./hepatitisBProfile";
import { uterineFibroidsProfile } from "./uterineFibroidsProfile";
import { geneTherapyProfile } from "./geneTherapyProfile";
import { regenerativeAestheticsProfile } from "./regenerativeAestheticsProfile";
import { medicalAestheticsProfile } from "./medicalAestheticsProfile";

export const DISEASE_PROFILES: Record<string, DiseaseProfile> = {
  hepatitis_b: hepatitisBProfile,
  uterine_fibroids: uterineFibroidsProfile,
  gene_therapy: geneTherapyProfile,
  regenerative_aesthetics: regenerativeAestheticsProfile,
  medical_aesthetics: medicalAestheticsProfile,
};

export function getDiseaseProfile(profileId: string): DiseaseProfile {
  const profile = DISEASE_PROFILES[profileId];

  if (!profile) {
    throw new Error(
      `Unknown disease profile: ${profileId}. Add it to src/ingestion/profiles/index.ts`
    );
  }

  return profile;
}

export type { DiseaseProfile } from "./types";