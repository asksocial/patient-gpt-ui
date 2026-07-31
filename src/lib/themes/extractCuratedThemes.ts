import {
  aiGateway,
  CURATED_THEMES_JSON_SCHEMA,
  createSystemAiContext,
} from "../ai-gateway";

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

  const response =
    await aiGateway.generate({
      context:
        createSystemAiContext(
          `extract_curated_${Date.now()}`
        ),
      promptId:
        "extract_curated_themes",
      input: prompt,
      jsonSchema: {
        name:
          "curated_themes",
        schema:
          CURATED_THEMES_JSON_SCHEMA,
      },
      parse: (text) =>
        JSON.parse(
          text
            .replace(
              /```json/g,
              ""
            )
            .replace(/```/g, "")
            .trim()
        ) as ExtractCuratedThemesResponse,
      validate: (value) => {
        if (
          !Array.isArray(
            value.themes
          )
        ) {
          throw new Error(
            "Missing themes array"
          );
        }
      },
    });

  if (
    response.status !==
    "completed"
  ) {
    throw new Error(
      response.reason
    );
  }

  return response.output.themes.map(
    (theme) => ({
      theme_name:
        theme.theme_name ?? "",
      theme_description:
        theme.theme_description ??
        "",
      report_excerpt:
        theme.report_excerpt ?? "",
      report_section:
        theme.report_section ?? "",
    })
  );
}
