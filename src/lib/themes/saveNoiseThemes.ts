import { getSupabaseServerClient } from "../supabase/server";
import { ExtractedNoiseTheme } from "./extractNoiseThemes";

type SaveNoiseThemesInput = {
  therapeuticArea: string;
  quarter?: string;
  themes: ExtractedNoiseTheme[];
};

export async function saveNoiseThemes(input: SaveNoiseThemesInput) {
  const { therapeuticArea, quarter, themes } = input;
  const supabase = getSupabaseServerClient();

  if (!themes.length) return [];

  const rows = themes.map((theme) => ({
    therapeutic_area: therapeuticArea,
    quarter: quarter ?? null,
    source_type: "noise_llm",
    theme_name: theme.theme_name,
    theme_description: theme.theme_description,
    mention_count: theme.mention_count ?? 0,
    engagement_sum: 0,
    confidence: theme.confidence ?? 0.7,
  }));

  const { data, error } = await supabase
    .from("live_themes")
    .insert(rows)
    .select();

  if (error) {
    throw new Error(`Failed to save noise themes: ${error.message}`);
  }

  return data ?? [];
}