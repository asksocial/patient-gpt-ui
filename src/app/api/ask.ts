import { assembleAnswer } from "../../answering/assembleAnswer";
import { CanonicalFinding } from "../../answering/models/finding";
import {
  AnswerIntent,
  TEMPLATE_REGISTRY,
} from "../../answering/templates/templateRegistry";

const MAX_FINDINGS_FOR_RENDERING = 50;

const HIGH_VALUE_MARKET_INTEREST_TERMS = [
  "regenerative aesthetics",
  "regenerative esthetics",
  "regenerative medicine",
  "regenerative biology",
  "medical aesthetics",
  "aesthetic medicine",
  "biostimulation",
  "biostimulator",
  "collagen stimulation",
  "collagen biostimulator",
  "skin longevity",
  "preventative aesthetics",
  "preventative treatments",
  "natural results",
  "natural-looking results",
  "subtle results",
  "tissue regeneration",
  "tissue health",
  "skin quality",
  "physician-led",
  "doctor-led",
  "clinically driven",
  "provider-led",
  "aesthetic clinic",
  "dermatologist",
  "injector",
  "exosome therapy",
  "polynucleotide treatment",
  "pdrn treatment",
  "prp",
  "prf",
  "sculptra",
  "radiesse",
  "skin booster treatment",
  "younger demographic",
  "younger consumers",
  "entering aesthetic clinics earlier",
  "skin health",
  "collagen",
  "regenerative positioning",
  "volume",
  "not volume",
  "skin quality over volume",
];

const LOW_VALUE_CONSUMER_SKINCARE_TERMS = [
  "moisturizer",
  "cream",
  "cleanser",
  "lip oil",
  "lip mask",
  "toner",
  "mist",
  "spray",
  "mask",
  "ampoule",
  "capsule cream",
  "gel mask",
  "whipped cleanser",
  "routine",
  "haul",
  "sephora",
  "boots",
  "amazon",
  "olive young",
  "shopwithme",
  "k-beauty edit",
  "favorite moisturizer",
  "product of the day",
  "skincare favorites",
  "skincare routine",
  "link in bio",
  "affiliate",
];

const CLINIC_PROMOTION_TERMS = [
  "call",
  "call:",
  "phone",
  "phone:",
  "whatsapp",
  "map :",
  "map:",
  "address:",
  "book now",
  "book your",
  "appointment",
  "free consultation",
  "contact us",
  "visit us",
  "dm us",
  "dm me",
  "special offer",
  "anniversary offer",
  "limited offer",
  "price list",
  "promo",
  "discount",
  "clinic hotline",
  "clinic located",
  "near bank",
  "plot no",
];

const HARD_REJECT_MARKET_INTEREST_TERMS = [
  "call :",
  "call:",
  "phone:",
  "whatsapp",
  "map :",
  "map:",
  "address:",
  "book now",
  "book your",
  "appointment",
  "free consultation",
  "contact us",
  "visit us",
  "special anniversary offer",
  "anniversary offer",
  "special offer",
  "limited offer",
  "price list",
  "discount",
  "promo code",
  "clinic hotline",
  "clinic located",
  "near bank",
  "plot no",
  "amazon",
  "sephora haul",
  "shopwithme",
  "link in bio",
  "affiliate",
  "prnewswire",
  "pr newswire",
  "business wire",
  "businesswire",
  "globe newswire",
  "press release",
  "media contact",
  "investor",
  "shareholder",
  "nasdaq",
  "quarterly revenue",
  "market report",
  "forecast period",
  "selected companies",
  "restructuring plans",
  "intellectual property portfolio",
  "global ambassador",
  "brand ambassador",
  "fan club",
  "fanclub",
  "korea's best barber",
  "haircut",
  "male makeup",
];

function classifyIntent(question: string): AnswerIntent {
  const q = question.toLowerCase();

  if (
    q.includes("growing interest") ||
    q.includes("interest in") ||
    q.includes("demand") ||
    q.includes("buzz") ||
    q.includes("trend") ||
    q.includes("trending") ||
    q.includes("why are people interested") ||
    q.includes("what is driving interest") ||
    q.includes("what is driving growing interest")
  ) {
    return "market_interest";
  }

  if (
    q.includes("education barrier") ||
    q.includes("education barriers") ||
    q.includes("awareness barrier") ||
    q.includes("knowledge gap") ||
    q.includes("confusion") ||
    q.includes("misunderstanding") ||
    q.includes("skepticism") ||
    q.includes("skeptical")
  ) {
    return "education_barriers";
  }

  if (
    q.includes("competitive alternative") ||
    q.includes("competitive alternatives") ||
    q.includes("alternative") ||
    q.includes("alternatives") ||
    q.includes("compare") ||
    q.includes("compared against") ||
    q.includes("versus") ||
    q.includes("vs ") ||
    q.includes("instead of")
  ) {
    return "competitive_alternatives";
  }

  if (
    q.includes("adoption driver") ||
    q.includes("adoption drivers") ||
    q.includes("drive adoption") ||
    q.includes("driving adoption") ||
    q.includes("what drives adoption") ||
    q.includes("motivates adoption")
  ) {
    return "adoption_drivers";
  }

  if (
    q.includes("market opportunity") ||
    q.includes("market opportunities") ||
    q.includes("opportunity") ||
    q.includes("opportunities") ||
    q.includes("white space") ||
    q.includes("whitespace")
  ) {
    return "market_opportunities";
  }

  if (
    q.includes("day-to-day impact") ||
    q.includes("day to day impact") ||
    q.includes("quality of life") ||
    q.includes("qol") ||
    q.includes("symptom burden") ||
    q.includes("biggest symptoms") ||
    q.includes("what symptoms") ||
    q.includes("symptom") ||
    q.includes("symptoms") ||
    q.includes("burden")
  ) {
    return "symptom_qol_burden";
  }

  if (
    q.includes("treatment decision") ||
    q.includes("treatment decisions") ||
    q.includes("treatment choice") ||
    q.includes("why do patients choose") ||
    q.includes("treatment journey") ||
    q.includes("choose") ||
    q.includes("choice") ||
    q.includes("preference") ||
    q.includes("switch")
  ) {
    return "treatment_decision_drivers";
  }

  if (
    q.includes("diagnosis") ||
    q.includes("misdiagnosed") ||
    q.includes("time to diagnosis") ||
    q.includes("barriers to diagnosis") ||
    q.includes("access") ||
    q.includes("delay")
  ) {
    return "diagnosis_barriers";
  }

  if (
    q.includes("side effect") ||
    q.includes("side effects") ||
    q.includes("safety") ||
    q.includes("tolerability") ||
    q.includes("risk")
  ) {
    return "safety_signals";
  }

  if (
    q.includes("market") ||
    q.includes("country") ||
    q.includes("countries") ||
    q.includes("geography") ||
    q.includes("regional") ||
    q.includes("market intelligence") ||
    q.includes("landscape") ||
    q.includes("platform") ||
    q.includes("channel")
  ) {
    return "market_landscape";
  }

  return "general";
}

function normalizeText(value?: string): string {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getFindingText(finding: CanonicalFinding): string {
  const f: any = finding;

  return [
    f.canonicalClaim,
    f.summary,
    f.title,
    f.description,
    f.text,
    f.excerpt,
    ...(f.labels || []),
    ...(f.normalizedLabels || []),
    ...(f.symptoms || []),
    ...(f.treatments || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterFindingsByTemplate(
  findings: CanonicalFinding[],
  intent: AnswerIntent
): CanonicalFinding[] {
  const template = TEMPLATE_REGISTRY[intent] || TEMPLATE_REGISTRY.general;

  return findings
    .filter((finding) => !finding.duplicateOf)
    .filter((finding) =>
      template.allowedFindingTypes.includes(String((finding as any).findingType))
    )
    .filter(
      (finding) =>
        !(template.disallowedFindingTypes || []).includes(
          String((finding as any).findingType)
        )
    );
}

function countFindingTypes(findings: CanonicalFinding[]): Record<string, number> {
  return findings.reduce<Record<string, number>>((acc, finding) => {
    const findingType = String((finding as any).findingType);
    acc[findingType] = (acc[findingType] || 0) + 1;
    return acc;
  }, {});
}

function hasAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function shouldHardRejectMarketInterest(finding: CanonicalFinding): boolean {
  const text = getFindingText(finding);
  return hasAny(text, HARD_REJECT_MARKET_INTEREST_TERMS);
}

function getIntentSignalScore(
  finding: CanonicalFinding,
  intent: AnswerIntent
): number {
  const text = getFindingText(finding);
  let score = 0;

  const f: any = finding;
  const findingType = String((finding as any).findingType);

  if (typeof f.confidence === "number") score += f.confidence * 10;
  if (typeof f.score === "number") score += Math.min(f.score, 100) / 20;

  if (f.sourceType === "live") score += 1;
  if ((f.evidence || []).length > 0) score += 1;

  if (intent === "market_interest") {
    if (findingType === "market_interest") score += 8;
    if (findingType === "adoption_driver") score += 6;

    if (
      hasAny(text, [
        "growing interest",
        "growing demand",
        "strong demand",
        "trend",
        "trending",
        "buzzy",
        "buzz",
        "consumer",
        "consumers",
        "awareness",
        "adoption",
        "market",
      ])
    ) {
      score += 8;
    }

    if (
      hasAny(text, [
        "younger demographic",
        "younger consumers",
        "entering aesthetic clinics earlier",
        "preventative treatments",
        "preventative aesthetics",
        "natural-looking results",
        "natural results",
        "collagen stimulation",
        "collagen synthesis",
        "tissue regeneration",
        "tissue health",
        "biostimulation",
        "biostimulator",
        "regenerative biology",
        "regenerative aesthetics",
        "skin quality over volume",
        "skin quality",
        "medical aesthetics",
        "aesthetic medicine",
      ])
    ) {
      score += 20;
    }

    if (
      hasAny(text, [
        "skin quality",
        "skin longevity",
        "visible results",
        "before and after",
        "collagen",
        "regenerative",
        "exosomes",
        "pdrn",
        "polynucleotide",
        "sculptra",
        "radiesse",
        "skin booster",
        "glow",
        "glass skin",
      ])
    ) {
      score += 5;
    }

    if (
      hasAny(text, [
        "i tried",
        "i got",
        "i had",
        "my skin",
        "my face",
        "my results",
        "patients ask",
        "clients ask",
        "as a dermatologist",
        "as an injector",
        "as a provider",
      ])
    ) {
      score += 3;
    }

    for (const term of HIGH_VALUE_MARKET_INTEREST_TERMS) {
      if (text.includes(term)) score += 8;
    }

    for (const term of LOW_VALUE_CONSUMER_SKINCARE_TERMS) {
      if (text.includes(term)) score -= 15;
    }
  }

  if (intent === "education_barriers") {
    if (findingType === "education_barrier") score += 8;

    if (
      hasAny(text, [
        "confused",
        "confusing",
        "what is",
        "skeptical",
        "misunderstanding",
        "education",
        "learn",
        "worth it",
        "safety",
        "risk",
        "downtime",
        "cost",
        "price",
      ])
    ) {
      score += 8;
    }
  }

  if (intent === "competitive_alternatives") {
    if (findingType === "competitive_alternative") score += 8;

    if (
      hasAny(text, [
        "botox",
        "filler",
        "fillers",
        "laser",
        "microneedling",
        "chemical peel",
        "hydrafacial",
        "facelift",
        "retinol",
        "serum",
        "skincare routine",
        "versus",
        "vs ",
        "instead of",
      ])
    ) {
      score += 8;
    }
  }

  if (intent === "adoption_drivers") {
    if (findingType === "adoption_driver") score += 8;

    if (
      hasAny(text, [
        "natural results",
        "visible results",
        "before and after",
        "game changer",
        "must-have",
        "why i love",
        "glow",
        "glass skin",
        "smooth",
        "hydration",
        "collagen",
        "minimal downtime",
        "clinically proven",
        "science-backed",
      ])
    ) {
      score += 8;
    }
  }

  if (intent === "market_opportunities") {
    if (findingType === "market_opportunity") score += 8;
    if (findingType === "market_interest") score += 5;
    if (findingType === "adoption_driver") score += 4;

    if (
      hasAny(text, [
        "opportunity",
        "white space",
        "market",
        "education",
        "awareness",
        "adoption",
        "demand",
        "trend",
      ])
    ) {
      score += 8;
    }
  }

  return score;
}

function getNoisePenalty(finding: CanonicalFinding): number {
  const text = getFindingText(finding);
  let penalty = 0;

  for (const term of LOW_VALUE_CONSUMER_SKINCARE_TERMS) {
    if (text.includes(term)) penalty += 75;
  }

  for (const term of CLINIC_PROMOTION_TERMS) {
    if (text.includes(term)) penalty += 150;
  }

  if (
    hasAny(text, [
      "call",
      "call:",
      "phone",
      "phone:",
      "whatsapp",
      "map :",
      "map:",
      "address:",
      "book now",
      "book your",
      "appointment",
      "free consultation",
      "contact us",
      "visit us",
      "dm us",
      "dm me",
      "special offer",
      "anniversary offer",
      "limited offer",
      "price list",
      "promo",
      "discount",
      "clinic hotline",
      "clinic located",
      "near bank",
      "plot no",
    ])
  ) {
    penalty += 150;
  }

  if (
    hasAny(text, [
      "amazon",
      "shop now",
      "add to cart",
      "promo code",
      "discount",
      "price list",
      "affiliate",
      "available now",
      "now available",
      "olive young",
      "global.oliveyoung",
      "sephora",
      "boots",
      "shopwithme",
      "haul",
      "jastip",
      "handcarry",
      "link in bio",
      "ltk",
      "liketk",
      "favorite moisturizer",
      "product of the day",
      "capsule cream",
      "gel mask",
      "lip oil",
      "cleanser",
      "spray",
      "mist",
    ])
  ) {
    penalty += 75;
  }

  if (
    hasAny(text, [
      "pr newswire",
      "prnewswire",
      "businesswire",
      "business wire",
      "globe newswire",
      "press release",
      "media contact",
      "announces",
      "announced",
      "launches",
      "expands",
      "expanding presence",
      "partnership",
      "in partnership",
      "restructuring plans",
      "intellectual property",
      "portfolio",
      "strengthening our intellectual property portfolio",
      "series a",
      "series b",
      "investor",
      "shareholder",
      "nasdaq",
      "quarterly revenue",
      "market report",
      "forecast period",
      "selected companies",
      "chapter 8",
      "e-commerce availability",
      "commercialize",
      "clinical validation",
      "global distributor",
      "north american market",
    ])
  ) {
    penalty += 100;
  }

  if (
    hasAny(text, [
      "brand ambassador",
      "global ambassador",
      "fanclub",
      "fan club",
      "presenter of",
      "k pop",
      "k-pop",
      "barber",
      "haircut",
      "male makeup",
    ])
  ) {
    penalty += 100;
  }

  if (
    hasAny(text, [
      "skin longevity explained",
      "gut microbiome",
      "metabolic skin longevity",
      "marine collagen",
      "perfume",
      "fragrance",
      "skincare simple",
      "orchid",
      "lavera",
      "lba : exceptional skincare",
      "gifted by",
      "general information only",
    ])
  ) {
    penalty += 75;
  }

  return penalty;
}

function uniqueByClaim(findings: CanonicalFinding[]): CanonicalFinding[] {
  const seen = new Set<string>();
  const output: CanonicalFinding[] = [];

  for (const finding of findings) {
    const f: any = finding;
    const claim = normalizeText(f.canonicalClaim || f.summary || f.title);

    if (!claim) continue;

    const key = claim.slice(0, 180);
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(finding);
  }

  return output;
}

function rankAndCapFindings(
  findings: CanonicalFinding[],
  intent: AnswerIntent
): CanonicalFinding[] {
  const candidates = findings.filter(
    (finding) =>
      !(intent === "market_interest" && shouldHardRejectMarketInterest(finding))
  );

  const ranked = [...candidates]
    .map((finding) => ({
      finding,
      rankScore:
        getIntentSignalScore(finding, intent) - getNoisePenalty(finding),
    }))
    .filter((item) => item.rankScore > 0)
    .sort((a, b) => b.rankScore - a.rankScore)
    .map((item) => item.finding);

  return uniqueByClaim(ranked).slice(0, MAX_FINDINGS_FOR_RENDERING);
}

export function askSocial(question: string, rawCards: CanonicalFinding[]) {
  const intent = classifyIntent(question);
  const templateFilteredCards = filterFindingsByTemplate(rawCards, intent);
  const rankedCards = rankAndCapFindings(templateFilteredCards, intent);

  const debug = {
    rawCount: rawCards.length,
    normalizedCount: rawCards.length,
    exactDedupedCount: rawCards.length,
    clusteredCount: rawCards.length,
    representativeCount: rawCards.length,
    templateFilteredCount: templateFilteredCards.length,
    rankedCount: rankedCards.length,
    questionIntent: intent,
    templateUsed: intent,
    rawFindingTypeCounts: countFindingTypes(rawCards),
    templateFilteredFindingTypeCounts: countFindingTypes(templateFilteredCards),
    rankedFindingTypeCounts: countFindingTypes(rankedCards),
  };

  const answer = assembleAnswer({
    question,
    intent,
    findings: rankedCards,
    debug,
    liveDataStatus: rankedCards.length > 0 ? "extends" : "not_found",
  });

  return {
    question,
    intent,
    answer,
  };
}