import {
  aiGateway,
  createSystemAiContext,
  NOISE_THEMES_JSON_SCHEMA,
} from "../ai-gateway";

export type NoiseMention = {
  text: string;
  engagement?: number;
  source?: string;
  url?: string;
};

export type ExtractedNoiseTheme = {
  theme_name: string;
  theme_description: string;
  mention_count: number;
  confidence: number;
  example_mentions: string[];
};

function chunkMentions<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function extractBatchThemes(
  mentions: NoiseMention[]
): Promise<ExtractedNoiseTheme[]> {
  const prompt = `
You are analyzing low-density social listening mentions that were not captured cleanly by clustering.

Group these mentions into 3 to 6 repeated interpretive themes.

Focus on:
- narratives
- beliefs
- emotional framing
- distrust of institutions
- policy/autonomy concerns
- backlash or conflict

Do NOT create a theme for every post.
Do NOT group only by repeated keywords.
Only surface themes that appear meaningfully across the batch.

Return valid JSON only in exactly this shape:
{
  "themes": [
    {
      "theme_name": "string",
      "theme_description": "string",
      "mention_count": number,
      "confidence": number,
      "example_mentions": ["string", "string"]
    }
  ]
}

Mentions:
${mentions.map((m, i) => `${i + 1}. ${m.text}`).join("\n")}
  `.trim();

  const response =
    await aiGateway.generate({
      context:
        createSystemAiContext(
          `extract_noise_${Date.now()}`
        ),
      promptId:
        "extract_noise_themes",
      input: prompt,
      jsonSchema: {
        name: "noise_themes",
        schema:
          NOISE_THEMES_JSON_SCHEMA,
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
        ) as {
          themes:
            ExtractedNoiseTheme[];
        },
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

  return response.output.themes;
}

export async function extractNoiseThemes(
  mentions: NoiseMention[],
  batchSize = 40
): Promise<ExtractedNoiseTheme[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (!mentions.length) {
    return [];
  }

  const batches = chunkMentions(mentions, batchSize);
  const allThemes: ExtractedNoiseTheme[] = [];

  for (const batch of batches) {
    const batchThemes = await extractBatchThemes(batch);
    allThemes.push(...batchThemes);
  }

  return allThemes;
}
