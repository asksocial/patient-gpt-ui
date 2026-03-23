export type ExtractedLiveTheme = {
  theme_name: string;
  theme_description: string;
  source_type: "cluster" | "noise_llm";
  mention_count: number;
  engagement_sum: number;
  confidence: number;
};

type ExtractLiveThemesInput = {
  rows: Array<{
    theme: string;
    explanation?: string;
    mention_count?: number;
    total_engagement?: number;
  }>;
};

export async function extractLiveThemes(
  input: ExtractLiveThemesInput
): Promise<ExtractedLiveTheme[]> {
  const { rows } = input;

  if (!rows?.length) {
    throw new Error("rows are required");
  }

  return rows.map((row) => ({
    theme_name: row.theme,
    theme_description: row.explanation ?? "",
    source_type: "cluster",
    mention_count: row.mention_count ?? 0,
    engagement_sum: row.total_engagement ?? 0,
    confidence: 0.8,
  }));
}