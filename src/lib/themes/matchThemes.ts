import {
  aiGateway,
  createSystemAiContext,
  THEME_MATCH_JSON_SCHEMA,
} from "../ai-gateway";

export type CuratedThemeInput = {
  theme_name: string;
  theme_description: string;
};

export type LiveThemeInput = {
  theme_name: string;
  theme_description: string;
  source_type: "cluster" | "noise_llm";
  mention_count: number;
  engagement_sum: number;
  confidence: number;
};

export type ThemeMatchResult = {
  live_theme_name: string;
  curated_theme_name: string | null;
  relationship: "covered" | "partial" | "emerging";
  similarity_score: number;
  rationale: string;
  confidence: number;
};

type MatchThemesInput = {
  curatedThemes: CuratedThemeInput[];
  liveThemes: LiveThemeInput[];
};

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbedding(text: string): Promise<number[]> {
  const response =
    await aiGateway.embed({
      context:
        createSystemAiContext(
          `theme_embedding_${Date.now()}`
        ),
      input: [text],
    });

  if (
    response.status !==
    "completed"
  ) {
    throw new Error(
      response.reason
    );
  }

  return response.output[0];
}

async function adjudicateMatch(
  liveTheme: LiveThemeInput,
  curatedTheme: CuratedThemeInput,
  similarityScore: number
): Promise<{
  relationship: "covered" | "partial" | "emerging";
  rationale: string;
  confidence: number;
}> {
  const prompt = `
You are comparing a live social-listening theme to a curated report theme.

Return JSON only in this exact format:
{
  "relationship": "covered" | "partial" | "emerging",
  "rationale": "string",
  "confidence": number
}

Definitions:
- covered: the curated theme clearly already includes the live theme
- partial: the curated theme overlaps but does not fully capture the live theme
- emerging: the live theme adds materially new context not clearly represented in the curated theme

Live theme:
Name: ${liveTheme.theme_name}
Description: ${liveTheme.theme_description}
Source type: ${liveTheme.source_type}
Mention count: ${liveTheme.mention_count}

Curated theme:
Name: ${curatedTheme.theme_name}
Description: ${curatedTheme.theme_description}

Similarity score: ${similarityScore}

Rules:
- Prefer "covered" only when overlap is strong.
- Use "partial" when the curated theme is adjacent but broader or less specific.
- Use "emerging" when the live theme introduces distinct narrative meaning.
- Return valid JSON only.
  `.trim();

  const response =
    await aiGateway.generate({
      context:
        createSystemAiContext(
          `adjudicate_theme_${Date.now()}`
        ),
      promptId:
        "adjudicate_theme_match",
      input: prompt,
      jsonSchema: {
        name:
          "theme_match",
        schema:
          THEME_MATCH_JSON_SCHEMA,
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
          relationship:
            | "covered"
            | "partial"
            | "emerging";
          rationale: string;
          confidence: number;
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

  return response.output;
}

export async function matchThemes(
  input: MatchThemesInput
): Promise<ThemeMatchResult[]> {
  const { curatedThemes, liveThemes } = input;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (!curatedThemes?.length) {
    throw new Error("curatedThemes are required");
  }

  if (!liveThemes?.length) {
    throw new Error("liveThemes are required");
  }

  const curatedEmbeddings = await Promise.all(
    curatedThemes.map(async (theme) => ({
      theme,
      embedding: await getEmbedding(
        `${theme.theme_name}. ${theme.theme_description}`
      ),
    }))
  );

  const results: ThemeMatchResult[] = [];

  for (const liveTheme of liveThemes) {
    const liveEmbedding = await getEmbedding(
      `${liveTheme.theme_name}. ${liveTheme.theme_description}`
    );

    const scoredCandidates = curatedEmbeddings
      .map(({ theme, embedding }) => ({
        theme,
        score: cosineSimilarity(liveEmbedding, embedding),
      }))
      .sort((a, b) => b.score - a.score);

    const bestCandidate = scoredCandidates[0];

    if (!bestCandidate) {
      results.push({
        live_theme_name: liveTheme.theme_name,
        curated_theme_name: null,
        relationship: "emerging",
        similarity_score: 0,
        rationale: "No curated theme candidates were available.",
        confidence: 0.5,
      });
      continue;
    }

    const adjudicated = await adjudicateMatch(
      liveTheme,
      bestCandidate.theme,
      bestCandidate.score
    );

    results.push({
      live_theme_name: liveTheme.theme_name,
      curated_theme_name:
        adjudicated.relationship === "emerging"
          ? null
          : bestCandidate.theme.theme_name,
      relationship: adjudicated.relationship,
      similarity_score: bestCandidate.score,
      rationale: adjudicated.rationale,
      confidence: adjudicated.confidence,
    });
  }

  return results;
}
