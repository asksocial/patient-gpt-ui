import { ThemeTaxonomy } from "../themeModels";
import { regenerativeAestheticsThemeTaxonomy } from "./regenerativeAesthetics";

export const THEME_TAXONOMIES: Record<string, ThemeTaxonomy> = {
  regenerative_aesthetics: regenerativeAestheticsThemeTaxonomy,
};

export function getThemeTaxonomy(therapeuticArea?: string): ThemeTaxonomy | null {
  if (!therapeuticArea) return null;
  return THEME_TAXONOMIES[therapeuticArea] || null;
}