import { ThemeTaxonomy } from "../themeModels";
import { regenerativeAestheticsThemeTaxonomy } from "./regenerativeAesthetics";
import { botulinumToxinThemeTaxonomy } from "./botulinumToxin";

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

  const normalizedTherapeuticArea =
    therapeuticArea
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  return THEME_TAXONOMIES[normalizedTherapeuticArea] || null;
}
