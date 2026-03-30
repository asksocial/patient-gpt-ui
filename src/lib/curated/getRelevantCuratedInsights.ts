import { loadCuratedInsights } from "./loadCuratedInsights";

type RelevantCuratedInsightsInput = {
  therapeuticArea: string;
  question: string;
};

const COUNTRY_LIST = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Czech Republic",
  "Finland",
  "Germany",
  "Hungary",
  "Italy",
  "Poland",
  "Portugal",
  "Spain",
  "Brazil",
  "Global",
];

const PERSONA_MAPPINGS: { label: string; patterns: string[] }[] = [
  { label: "Pregnant", patterns: ["pregnant", "pregnancy"] },
  { label: "Symptomatic", patterns: ["symptomatic", "symptoms", "pain"] },
  {
    label: "Fertility Concerned",
    patterns: ["fertility", "infertility", "conceive"],
  },
  {
    label: "Surgery Concerned",
    patterns: ["surgery", "surgical", "embolization", "hysterectomy"],
  },
  { label: "Treatment Seeking", patterns: ["treatment", "treatments"] },
  {
    label: "Post-Procedure",
    patterns: ["post-procedure", "recovery", "after procedure"],
  },
  { label: "Access Limited", patterns: ["access", "clinic", "afford"] },
  { label: "Comorbid Condition", patterns: ["endometriosis", "comorbid"] },
];

function inferCountries(question: string): string[] {
  const lower = question.toLowerCase();
  return COUNTRY_LIST.filter((country) =>
    lower.includes(country.toLowerCase())
  );
}

function inferPersona(question: string): string | undefined {
  const lower = question.toLowerCase();

  return PERSONA_MAPPINGS.find((item) =>
    item.patterns.some((pattern) => lower.includes(pattern))
  )?.label;
}

function inferInsightTypes(question: string): string[] | undefined {
  const lower = question.toLowerCase();
  const types = new Set<string>();

  if (
    lower.includes("platform") ||
    lower.includes("forum") ||
    lower.includes("forums") ||
    lower.includes("reddit") ||
    lower.includes("facebook") ||
    lower.includes("where do") ||
    lower.includes("where are")
  ) {
    types.add("platform_preference");
    types.add("conversation_behavior");
  }

  if (
    lower.includes("country") ||
    lower.includes("market") ||
    lower.includes("versus") ||
    lower.includes("vs") ||
    lower.includes("differ") ||
    COUNTRY_LIST.some((country) => lower.includes(country.toLowerCase()))
  ) {
    types.add("country_pattern");
  }

  if (
    lower.includes("persona") ||
    lower.includes("pregnant") ||
    lower.includes("symptomatic") ||
    lower.includes("caregiver") ||
    lower.includes("patient type")
  ) {
    types.add("persona");
  }

  if (
    lower.includes("barrier") ||
    lower.includes("challenge") ||
    lower.includes("obstacle")
  ) {
    types.add("barrier");
  }

  if (
    lower.includes("trust") ||
    lower.includes("believe") ||
    lower.includes("skeptic")
  ) {
    types.add("trust_signal");
  }

  if (
    lower.includes("need") ||
    lower.includes("question") ||
    lower.includes("information") ||
    lower.includes("educat")
  ) {
    types.add("information_need");
  }

  return types.size ? Array.from(types) : undefined;
}

function uniqById<T extends { id?: string; title?: string }>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = item.id || item.title || JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

function scoreInsight(
  insight: any,
  countries: string[],
  persona?: string,
  insightTypes?: string[]
) {
  let score = 0;
  const country = (insight.country || "").toLowerCase();
  const countrySet = new Set(countries.map((c) => c.toLowerCase()));

  if (countrySet.has(country)) score += 100;
  if (country === "global") score += 40;

  if (
    persona &&
    insight.persona &&
    insight.persona.toLowerCase().includes(persona.toLowerCase())
  ) {
    score += 20;
  }

  if (
    insightTypes?.length &&
    insight.insight_type &&
    insightTypes.includes(insight.insight_type)
  ) {
    score += 15;
  }

  if (typeof insight.importance === "number") {
    score += insight.importance * 10;
  }

  if (typeof insight.confidence === "number") {
    score += insight.confidence * 5;
  }

  return score;
}

function sortInsights(
  items: any[],
  countries: string[],
  persona?: string,
  insightTypes?: string[]
) {
  return [...items].sort((a, b) => {
    const scoreA = scoreInsight(a, countries, persona, insightTypes);
    const scoreB = scoreInsight(b, countries, persona, insightTypes);

    if (scoreA !== scoreB) return scoreB - scoreA;
    return 0;
  });
}

export async function getRelevantCuratedInsights({
  therapeuticArea,
  question,
}: RelevantCuratedInsightsInput) {
  const countries = inferCountries(question);
  const persona = inferPersona(question);
  const insightTypes = inferInsightTypes(question);

  const hasExplicitCountryScope = countries.length > 0;

  if (hasExplicitCountryScope) {
    const broadCountryResults = await Promise.all(
      countries.map((country) =>
        loadCuratedInsights({
          therapeuticArea,
          country,
          limit: 8,
        })
      )
    );

    const explicitCountryMatches = uniqById(broadCountryResults.flat());

    const globalSupport = await loadCuratedInsights({
      therapeuticArea,
      country: "Global",
      limit: 4,
    });

    const combined = uniqById([...explicitCountryMatches, ...globalSupport]);
    const sorted = sortInsights(combined, countries, persona, insightTypes);

    return sorted.slice(0, 12);
  }

  const targeted = await loadCuratedInsights({
    therapeuticArea,
    persona,
    insightTypes,
    limit: 12,
  });

  if (targeted.length >= 6) {
    return targeted.slice(0, 12);
  }

  const fallback = await loadCuratedInsights({
    therapeuticArea,
    limit: 12,
  });

  return uniqById([...targeted, ...fallback]).slice(0, 12);
}