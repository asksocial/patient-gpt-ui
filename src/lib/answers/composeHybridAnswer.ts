import OpenAI from "openai";

type CuratedTheme = {
  theme_name: string;
  theme_description: string;
  report_excerpt?: string;
  report_section?: string;
};

type LiveTheme = {
  theme_name: string;
  theme_description: string;
  source_type: "cluster" | "noise_llm";
  mention_count: number;
  engagement_sum: number;
  confidence: number;
};

type ThemeMatch = {
  live_theme_name: string;
  curated_theme_name: string | null;
  relationship: "covered" | "partial" | "emerging";
  similarity_score: number;
  rationale: string;
  confidence: number;
};

export type HybridAnswer = {
  directAnswer: string;
  curatedIntelligence: {
    themes: Array<{
      name: string;
      description: string;
    }>;
  };
  liveData: {
    themes: Array<{
      name: string;
      description: string;
      sourceType: "cluster" | "noise_llm";
      relationship: "covered" | "partial" | "emerging";
    }>;
    emergingNarratives: string[];
  };
  whatThisMeans: string;
};

type ComposeHybridAnswerInput = {
  question: string;
  curatedThemes: CuratedTheme[];
  liveThemes: LiveTheme[];
  matches: ThemeMatch[];
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function composeHybridAnswer(
  input: ComposeHybridAnswerInput
): Promise<HybridAnswer> {
  const { question, curatedThemes, liveThemes, matches } = input;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const curatedSummary = curatedThemes.slice(0, 3).map((theme) => ({
    name: theme.theme_name,
    description: theme.theme_description,
  }));

  const matchedLiveThemes = liveThemes
    .map((liveTheme) => {
      const match = matches.find(
        (m) => m.live_theme_name === liveTheme.theme_name
      );

      return {
        name: liveTheme.theme_name,
        description: liveTheme.theme_description,
        sourceType: liveTheme.source_type,
        relationship: match?.relationship ?? "emerging",
        mentionCount: liveTheme.mention_count,
        confidence: liveTheme.confidence,
      };
    })
    .sort((a, b) => {
      const relationshipRank = {
        emerging: 0,
        partial: 1,
        covered: 2,
      };

      const sourceTypeRank = {
        noise_llm: 0,
        cluster: 1,
      };

      const relationshipDiff =
        relationshipRank[a.relationship] - relationshipRank[b.relationship];
      if (relationshipDiff !== 0) return relationshipDiff;

      const sourceTypeDiff =
        sourceTypeRank[a.sourceType] - sourceTypeRank[b.sourceType];
      if (sourceTypeDiff !== 0) return sourceTypeDiff;

      return (b.mentionCount ?? 0) - (a.mentionCount ?? 0);
    });

  const emergingNarratives = matchedLiveThemes
    .filter((theme) => theme.relationship === "emerging")
    .map((theme) => theme.name);

  const prompt = `
You are composing an AskSocial answer for a pharma/social-intelligence user.

Question:
${question}

Curated intelligence themes:
${JSON.stringify(curatedSummary, null, 2)}

Live data themes:
${JSON.stringify(matchedLiveThemes, null, 2)}

Emerging narratives:
${JSON.stringify(emergingNarratives, null, 2)}

Task:
Write two fields only:
1. directAnswer
2. whatThisMeans

Return valid JSON only in exactly this shape:
{
  "directAnswer": "string",
  "whatThisMeans": "string"
}

Rules:
- directAnswer should be 1-2 sentences.
- Start from the curated baseline, then incorporate live data.
- Present live themes as added context, not as contradictions or report failures.
- Never say the report "missed" something.
- Use language like "live data adds", "recent conversation shows", or "emerging narratives include".
- whatThisMeans should explain why the live additions matter in 1-2 sentences.
- Be specific to the themes provided.
- Some live themes come from "noise_llm", which means they reflect lower-density but meaningful emerging narratives.
- When present, use noise_llm themes to explain shifts in trust, autonomy, backlash, belief-driven discourse, or policy-related conversation.
- Treat source_type "noise_llm" themes as especially useful for surfacing emerging narratives.
- Give more weight to themes marked "emerging" than themes marked "covered".
- No markdown fences.
`.trim();

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error("Model returned empty output");
  }

  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  let parsed: { directAnswer: string; whatThisMeans: string };

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("RAW MODEL OUTPUT:", text);
    throw new Error("Failed to parse hybrid answer JSON");
  }

  return {
    directAnswer: parsed.directAnswer,
    curatedIntelligence: {
      themes: curatedSummary,
    },
    liveData: {
      themes: matchedLiveThemes.map((theme) => ({
        name: theme.name,
        description: theme.description,
        sourceType: theme.sourceType,
        relationship: theme.relationship,
      })),
      emergingNarratives,
    },
    whatThisMeans: parsed.whatThisMeans,
  };
}