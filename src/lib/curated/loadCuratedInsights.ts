import { getSupabaseServerClient } from "../supabase/server";

export async function loadCuratedInsights({
  therapeuticArea,
  insightTypes,
  country,
  persona,
  platform,
  limit = 50,
}: {
  therapeuticArea: string;
  insightTypes?: string[];
  country?: string;
  persona?: string;
  platform?: string;
  limit?: number;
}) {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from("curated_insights")
    .select("*")
    .eq("therapeutic_area", therapeuticArea)
    .order("importance", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (insightTypes?.length) {
    query = query.in("insight_type", insightTypes);
  }

  if (country) {
    query = query.eq("country", country);
  }

  if (persona) {
    query = query.eq("persona", persona);
  }

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[loadCuratedInsights] supabase error", error);
    throw new Error(`Failed to load curated insights: ${error.message}`);
  }

  return data ?? [];
}