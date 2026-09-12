import { ThemeTaxonomy } from "../themeModels";
import { regenerativeAestheticsThemeTaxonomy } from "./regenerativeAesthetics";
import { botulinumToxinThemeTaxonomy } from "./botulinumToxin";
import { createGenericThemeTaxonomy } from "./genericTherapeuticArea";
import { normalizeTherapeuticAreaId } from "../../../lib/analytics/coverage";

const medicalAestheticsThemeTaxonomy: ThemeTaxonomy = {
  ...regenerativeAestheticsThemeTaxonomy,
  therapeuticArea: "medical_aesthetics",
};

export const THEME_TAXONOMIES: Record<string, ThemeTaxonomy> = {
  regenerative_aesthetics: regenerativeAestheticsThemeTaxonomy,
  medical_aesthetics: medicalAestheticsThemeTaxonomy,
  botulinum_toxin: botulinumToxinThemeTaxonomy,
};

export function getThemeTaxonomy(therapeuticArea?: string): ThemeTaxonomy | null {
  if (!therapeuticArea) return null;

  const normalizedTherapeuticArea = normalizeTherapeuticAreaId(therapeuticArea);

  return (
    THEME_TAXONOMIES[normalizedTherapeuticArea] ||
    createGenericThemeTaxonomy(normalizedTherapeuticArea)
  );
}
