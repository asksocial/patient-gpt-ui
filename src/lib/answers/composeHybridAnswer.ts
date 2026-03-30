import OpenAI from "openai";

type CuratedTheme = {
  name: string;
  description: string;
};

type LiveTheme = {
  name: string;
  description: string;
  sourceType?: "cluster" | "noise_llm" | string;
  relationship?: "emerging" | "partial" | "covered" | string;
};

type ThemeMatch = {
  live_theme_name: string;
  curated_theme_name?: string | null;
  relationship?: "emerging" | "partial" | "covered" | string;
  rationale?: string | null;
  confidence?: number | null;
};

type CuratedInsight = {
  id?: string;
  therapeutic_area: string;
  source_name?: string | null;
  source_type?: string | null;
  source_date?: string | null;
  insight_type: string;
  title: string;
  summary?: string | null;
  detail?: string | null;
  evidence_excerpt?: string | null;
  country?: string | null;
  region?: string | null;
  persona?: string | null;
  platform?: string | null;
  audience?: string | null;
  journey_stage?: string | null;
  topic?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, any> | null;
  confidence?: number | null;
  importance?: number | null;
};

export type ComposeHybridAnswerInput = {
  question: string;
  therapeuticArea: string;
  curatedThemes: CuratedTheme[];
  liveThemes: LiveTheme[];
  matches: ThemeMatch[];
  curatedInsights?: CuratedInsight[];
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
      sourceType?: string;
      relationship?: string;
    }>;
    emergingNarratives: string[];
  };
  whatThisMeans: string;
  recommendedActions: string[];
};

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function compactText(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function uniqByKey<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

function formatCuratedThemesForPrompt(curatedThemes: CuratedTheme[]) {
  if (!curatedThemes?.length) return "None";

  return curatedThemes
    .map(
      (theme, index) =>
        `${index + 1}. ${theme.name}\n   - Description: ${compactText(theme.description)}`
    )
    .join("\n");
}

function formatLiveThemesForPrompt(liveThemes: LiveTheme[]) {
  if (!liveThemes?.length) return "None";

  return liveThemes
    .map((theme, index) => {
      const parts = [
        `${index + 1}. ${theme.name}`,
        `   - Description: ${compactText(theme.description)}`,
      ];

      if (theme.sourceType) {
        parts.push(`   - Source type: ${theme.sourceType}`);
      }

      if (theme.relationship) {
        parts.push(`   - Relationship: ${theme.relationship}`);
      }

      return parts.join("\n");
    })
    .join("\n");
}

function formatMatchesForPrompt(matches: ThemeMatch[]) {
  if (!matches?.length) return "None";

  return matches
    .map((match, index) => {
      const parts = [
        `${index + 1}. Live theme: ${match.live_theme_name}`,
        `   - Curated theme: ${match.curated_theme_name || "None / unmatched"}`,
      ];

      if (match.relationship) {
        parts.push(`   - Relationship: ${match.relationship}`);
      }

      if (match.rationale) {
        parts.push(`   - Rationale: ${compactText(match.rationale)}`);
      }

      if (typeof match.confidence === "number") {
        parts.push(`   - Confidence: ${match.confidence}`);
      }

      return parts.join("\n");
    })
    .join("\n");
}

function formatCuratedInsightsForPrompt(curatedInsights: CuratedInsight[] = []) {
  if (!curatedInsights.length) return "None";

  return curatedInsights
    .map((insight, index) => {
      const parts = [
        `${index + 1}. ${insight.title}`,
        `   - Type: ${insight.insight_type}`,
      ];

      if (insight.country) parts.push(`   - Country: ${insight.country}`);
      if (insight.persona) parts.push(`   - Persona: ${insight.persona}`);
      if (insight.platform) parts.push(`   - Platform: ${insight.platform}`);
      if (insight.topic) parts.push(`   - Topic: ${insight.topic}`);
      if (insight.journey_stage) {
        parts.push(`   - Journey stage: ${insight.journey_stage}`);
      }
      if (insight.summary) {
        parts.push(`   - Summary: ${compactText(insight.summary)}`);
      }
      if (insight.detail) {
        parts.push(`   - Detail: ${compactText(insight.detail)}`);
      }
      if (insight.evidence_excerpt) {
        parts.push(`   - Evidence: ${compactText(insight.evidence_excerpt)}`);
      }

      return parts.join("\n");
    })
    .join("\n");
}

function extractEmergingNarratives(liveThemes: LiveTheme[]) {
  return liveThemes
    .filter((theme) => theme.relationship === "emerging")
    .map((theme) => theme.name);
}

function formatInsightTypeLabel(value?: string | null) {
  if (!value) return "Curated Insight";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveCuratedThemesFromInsights(
  curatedInsights: CuratedInsight[] = []
): CuratedTheme[] {
  if (!curatedInsights.length) return [];

  const normalized = curatedInsights.map((insight) => {
    const parts: string[] = [];

    if (insight.country) parts.push(insight.country);
    if (insight.persona) parts.push(insight.persona);
    parts.push(formatInsightTypeLabel(insight.insight_type));

    const descriptionParts = [
      compactText(insight.summary),
      compactText(insight.detail),
      compactText(insight.evidence_excerpt),
    ].filter(Boolean);

    return {
      name: parts.join(" • "),
      description:
        descriptionParts[0] || compactText(insight.title) || "Curated insight",
      importance: typeof insight.importance === "number" ? insight.importance : 0,
    };
  });

  const deduped = uniqByKey(
    normalized,
    (item) => `${item.name}|${item.description}`
  );

  return deduped
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 6)
    .map(({ name, description }) => ({ name, description }));
}

function deriveRecommendedActions({
  question,
  curatedInsights = [],
  curatedThemes = [],
  liveThemes = [],
}: {
  question: string;
  curatedInsights?: CuratedInsight[];
  curatedThemes?: CuratedTheme[];
  liveThemes?: LiveTheme[];
}) {
  const actions: string[] = [];

  const topCountryInsights = uniqByKey(
    curatedInsights
      .filter((item) => item.country && item.country !== "Global")
      .sort(
        (a, b) =>
          (typeof b.importance === "number" ? b.importance : 0) -
          (typeof a.importance === "number" ? a.importance : 0)
      ),
    (item) => item.country || item.title
  ).slice(0, 2);

  topCountryInsights.forEach((insight) => {
    const country = insight.country || "priority markets";
    const topic = compactText(insight.topic) || formatInsightTypeLabel(insight.insight_type);
    const platform = compactText(insight.platform);
    const persona = compactText(insight.persona);

    if (platform) {
      actions.push(
        `Prioritize ${country} engagement around ${topic.toLowerCase()} and test content distribution in ${platform}.`
      );
    } else if (persona) {
      actions.push(
        `Tailor ${country} messaging to ${persona.toLowerCase()} audiences, especially around ${topic.toLowerCase()}.`
      );
    } else {
      actions.push(
        `Adapt ${country} messaging to address the strongest signal around ${topic.toLowerCase()}.`
      );
    }
  });

  const topGlobalPersona = curatedInsights.find(
    (item) => item.country === "Global" && item.persona
  );

  if (topGlobalPersona) {
    actions.push(
      `Build persona-specific education for ${topGlobalPersona.persona.toLowerCase()} audiences using the strongest recurring concerns surfaced in curated intelligence.`
    );
  }

  const emergingThemes = liveThemes.filter(
    (theme) => theme.relationship === "emerging"
  );

  if (emergingThemes.length) {
    actions.push(
      `Pressure-test existing messaging against emerging live narratives such as ${emergingThemes
        .slice(0, 2)
        .map((theme) => theme.name)
        .join(" and ")}.`
    );
  }

  if (!actions.length && curatedThemes.length) {
    actions.push(
      `Turn the top curated themes into market-ready messaging briefs and channel-specific content hypotheses.`
    );
  }

  if (!actions.length) {
    actions.push(
      `Use this answer as a starting point for localized message testing and deeper qualitative validation.`
    );
  }

  return uniq(actions).slice(0, 4);
}

function buildFallbackAnswer({
  question,
  curatedThemes,
  liveThemes,
  curatedInsights = [],
}: ComposeHybridAnswerInput): HybridAnswer {
  const effectiveCuratedThemes = curatedInsights.length
    ? deriveCuratedThemesFromInsights(curatedInsights)
    : curatedThemes;

  const topCuratedThemes = effectiveCuratedThemes.slice(0, 6);
  const topLiveThemes = liveThemes.slice(0, 6);
  const emergingNarratives = uniq(extractEmergingNarratives(liveThemes));
  const topCuratedInsights = curatedInsights.slice(0, 6);

  const countries = uniq(
    topCuratedInsights
      .map((insight) => compactText(insight.country))
      .filter(Boolean)
  );

  const directAnswer = topCuratedInsights.length
    ? `For ${question}, curated intelligence shows meaningful differences across ${countries.join(", ") || "the available markets"}. The most relevant signals include ${topCuratedInsights
        .slice(0, 3)
        .map((insight) => compactText(insight.title))
        .join("; ")}.`
    : `For ${question}, the baseline curated intelligence points to ${
        topCuratedThemes.length
          ? topCuratedThemes.map((theme) => theme.name).join(", ")
          : "no major baseline themes were available"
      }. Live conversation adds or reinforces ${
        topLiveThemes.length
          ? topLiveThemes.map((theme) => theme.name).join(", ")
          : "no strong live themes were available"
      }.`;

  const whatThisMeans = topCuratedInsights.length
    ? `This suggests strategy should be tailored to the country-, persona-, and platform-specific signals present in the curated intelligence, rather than relying on generic category messaging alone.`
    : `This suggests the most useful strategy is to anchor on the baseline report themes while using live data to identify where new narratives are emerging, intensifying, or changing in tone.`;

  const recommendedActions = deriveRecommendedActions({
    question,
    curatedInsights,
    curatedThemes: topCuratedThemes,
    liveThemes: topLiveThemes,
  });

  return {
    directAnswer,
    curatedIntelligence: {
      themes: topCuratedThemes.map((theme) => ({
        name: theme.name,
        description: theme.description,
      })),
    },
    liveData: {
      themes: topLiveThemes.map((theme) => ({
        name: theme.name,
        description: theme.description,
        sourceType: theme.sourceType,
        relationship: theme.relationship,
      })),
      emergingNarratives,
    },
    whatThisMeans,
    recommendedActions,
  };
}

function stripCodeFences(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonObject(text: string) {
  const cleaned = stripCodeFences(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return valid JSON.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeAnswerShape(
  value: any,
  fallback: ComposeHybridAnswerInput
): HybridAnswer {
  const fallbackAnswer = buildFallbackAnswer(fallback);

  const curatedThemes =
    Array.isArray(value?.curatedIntelligence?.themes) &&
    value.curatedIntelligence.themes.length
      ? value.curatedIntelligence.themes
      : fallbackAnswer.curatedIntelligence.themes;

  const liveThemes =
    Array.isArray(value?.liveData?.themes) && value.liveData.themes.length
      ? value.liveData.themes
      : fallbackAnswer.liveData.themes;

  const emergingNarratives =
    Array.isArray(value?.liveData?.emergingNarratives) &&
    value.liveData.emergingNarratives.length
      ? value.liveData.emergingNarratives
      : fallbackAnswer.liveData.emergingNarratives;

  const recommendedActions =
    Array.isArray(value?.recommendedActions) && value.recommendedActions.length
      ? value.recommendedActions
      : fallbackAnswer.recommendedActions;

  return {
    directAnswer:
      compactText(value?.directAnswer) || fallbackAnswer.directAnswer,
    curatedIntelligence: {
      themes: curatedThemes.map((theme: any) => ({
        name: compactText(theme?.name) || "Unnamed theme",
        description: compactText(theme?.description) || "",
      })),
    },
    liveData: {
      themes: liveThemes.map((theme: any) => ({
        name: compactText(theme?.name) || "Unnamed live theme",
        description: compactText(theme?.description) || "",
        sourceType: compactText(theme?.sourceType) || undefined,
        relationship: compactText(theme?.relationship) || undefined,
      })),
      emergingNarratives: uniq(
        emergingNarratives
          .map((item: any) => compactText(item))
          .filter(Boolean)
      ),
    },
    whatThisMeans:
      compactText(value?.whatThisMeans) || fallbackAnswer.whatThisMeans,
    recommendedActions: uniq(
      recommendedActions
        .map((item: any) => compactText(item))
        .filter(Boolean)
    ).slice(0, 4),
  };
}

export async function composeHybridAnswer(
  input: ComposeHybridAnswerInput
): Promise<HybridAnswer> {
  const {
    question,
    therapeuticArea,
    curatedThemes,
    liveThemes,
    matches,
    curatedInsights = [],
  } = input;

  const effectiveCuratedThemes = curatedInsights.length
    ? deriveCuratedThemesFromInsights(curatedInsights)
    : curatedThemes;

  const shouldUseDeterministicFallback =
    curatedInsights.length > 0 &&
    curatedThemes.length === 0 &&
    liveThemes.length === 0;

  if (!client || shouldUseDeterministicFallback) {
    return buildFallbackAnswer({
      ...input,
      curatedThemes: effectiveCuratedThemes,
    });
  }

  const curatedThemesBlock =
    formatCuratedThemesForPrompt(effectiveCuratedThemes);
  const liveThemesBlock = formatLiveThemesForPrompt(liveThemes);
  const matchesBlock = formatMatchesForPrompt(matches);
  const curatedInsightsBlock = formatCuratedInsightsForPrompt(curatedInsights);

  const systemPrompt = `
You are AskSocial, an AI social intelligence product for pharma and biotech teams.

Your writing style:
- Strategic and commercially useful
- Concise but not robotic
- Product-like, not academic
- Synthesized, not just listed
- Grounded in the supplied baseline themes, curated insights, and live themes

You must return valid JSON only.
`;

  const userPrompt = `
QUESTION:
${question}

THERAPEUTIC AREA:
${therapeuticArea}

CURATED BASELINE THEMES:
${curatedThemesBlock}

RELEVANT CURATED INSIGHTS:
${curatedInsightsBlock}

LIVE THEMES:
${liveThemesBlock}

THEME MATCHES:
${matchesBlock}

Return JSON with this exact shape:
{
  "directAnswer": "string",
  "curatedIntelligence": {
    "themes": [
      {
        "name": "string",
        "description": "string"
      }
    ]
  },
  "liveData": {
    "themes": [
      {
        "name": "string",
        "description": "string",
        "sourceType": "string",
        "relationship": "string"
      }
    ],
    "emergingNarratives": ["string"]
  },
  "whatThisMeans": "string",
  "recommendedActions": ["string"]
}

Rules:
- directAnswer should sound like AskSocial: strategic, synthesized, decision-useful.
- If curatedInsights are provided, you MUST use them to construct the answer.
- Do NOT say that data is unavailable if curatedInsights exist.
- curatedInsights should be treated as primary evidence when curatedThemes are empty.
- The directAnswer MUST explicitly reference relevant countries, personas, or patterns from curatedInsights when applicable.
- curatedIntelligence.themes should preserve the most relevant baseline themes.
- If baseline themes are unavailable, derive curatedIntelligence.themes from the curated insights.
- liveData.themes should preserve the most relevant live themes.
- Use relevant curated insights when they add country, persona, platform, trust, barrier, or information-need specificity.
- If relevant curated insights are geography- or persona-specific, reflect that explicitly in directAnswer or whatThisMeans.
- recommendedActions should be 2 to 4 concise, practical next steps.
- recommendedActions should sound operational and commercially useful.
- Favor synthesis over repetition.
- Do not invent facts not present in the provided inputs.
- emergingNarratives should include live themes that are clearly emerging.
- Output only JSON.
`;

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: systemPrompt.trim(),
        },
        {
          role: "user",
          content: userPrompt.trim(),
        },
      ],
    });

    const text = response.choices?.[0]?.message?.content || "";
    const parsed = parseJsonObject(text);

    return normalizeAnswerShape(parsed, {
      ...input,
      curatedThemes: effectiveCuratedThemes,
    });
  } catch (error) {
    console.error("[composeHybridAnswer] fallback triggered", error);
    return buildFallbackAnswer({
      ...input,
      curatedThemes: effectiveCuratedThemes,
    });
  }
}