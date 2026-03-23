import OpenAI from "openai";

export type ExtractedCuratedTheme = {
  theme_name: string;
  theme_description: string;
  report_excerpt: string;
  report_section: string;
};

type ExtractCuratedThemesInput = {
  therapeuticArea: string;
  quarter?: string;
  reportText: string;
};

type ExtractCuratedThemesResponse = {
  themes: ExtractedCuratedTheme[];
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractCuratedThemes(
  input: ExtractCuratedThemesInput
): Promise<ExtractedCuratedTheme[]> {
  const { therapeuticArea, quarter, reportText } = input;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (!reportText || !reportText.trim()) {
    throw new Error("reportText is required");
  }

  const prompt = `
You are extracting curated intelligence themes from a social intelligence report.

Therapeutic area: ${therapeuticArea}
Quarter: ${quarter ?? "Unknown"}

Task:
Extract 3 to 8 major report themes.

Return JSON only in this exact shape:
{
  "themes": [
    {
      "theme_name": "string",
      "theme_description": "string",
      "report_excerpt": "string",
      "report_section": "string"
    }
  ]
}

Rules:
- Capture only the major report themes, not every detail.
- Keep theme_name short and clear.
- theme_description should be 1-2 sentences.
- report_excerpt should be a short verbatim excerpt from the report that supports the theme.
- report_section should be a label like "Executive Summary", "Key Themes", or "Recommendations".
- Do not invent content not present in the report.
- Return valid JSON only. No markdown fences.

Report:
${reportText}
  `.trim();

  const response = await openai.responses.create({
    model: "gpt-5.4",
    input: prompt,
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error("Model returned empty output");
  }

  try {
    const parsed = JSON.parse(text) as ExtractCuratedThemesResponse;

    if (!parsed.themes || !Array.isArray(parsed.themes)) {
      throw new Error("Missing themes array");
    }

    return parsed.themes.map((theme) => ({
      theme_name: theme.theme_name ?? "",
      theme_description: theme.theme_description ?? "",
      report_excerpt: theme.report_excerpt ?? "",
      report_section: theme.report_section ?? "",
    }));
  } catch (error) {
    console.error("Failed to parse extractCuratedThemes response:", text);
    throw new Error("Could not parse curated themes JSON");
  }
}