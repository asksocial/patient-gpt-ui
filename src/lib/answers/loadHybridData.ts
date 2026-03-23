import { getSupabaseServerClient } from "../supabase/server";

export async function loadHybridData(therapeuticArea: string) {
  const supabase = getSupabaseServerClient();

  const { data: curatedThemes, error: curatedError } = await supabase
    .from("curated_themes")
    .select("theme_name, theme_description, report_excerpt, report_section")
    .eq("therapeutic_area", therapeuticArea)
    .order("created_at", { ascending: true });

  if (curatedError) {
    throw new Error(`Failed to load curated themes: ${curatedError.message}`);
  }

  const { data: liveThemes, error: liveError } = await supabase
    .from("live_themes")
    .select("theme_name, theme_description, source_type, mention_count, engagement_sum, confidence")
    .eq("therapeutic_area", therapeuticArea)
    .order("created_at", { ascending: true });

  if (liveError) {
    throw new Error(`Failed to load live themes: ${liveError.message}`);
  }

  const { data: matches, error: matchesError } = await supabase
    .from("theme_matches")
    .select("live_theme_name, curated_theme_name, relationship, similarity_score, rationale, confidence")
    .eq("therapeutic_area", therapeuticArea)
    .order("created_at", { ascending: true });

  if (matchesError) {
    throw new Error(`Failed to load theme matches: ${matchesError.message}`);
  }

  return {
    curatedThemes: curatedThemes ?? [],
    liveThemes: liveThemes ?? [],
    matches: matches ?? [],
  };
}