import fs from "fs";
import path from "path";
import { getDiseaseProfile } from "../profiles";
import { CuratedFindingRecord } from "./index";

type PageExtraction = {
  pageNumber: number;
  text: string;
};

type SemanticBlock = {
  blockNumber: number;
  sourcePageNumber: number;
  heading: string;
  text: string;
};

function normalizeText(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function includesAny(text: string, phrases: string[]): boolean {
  const lower = text.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase.toLowerCase()));
}

function extractByPatternMap(
  text: string,
  patternMap: Record<string, string[]>
): string[] {
  const found: string[] = [];

  for (const [label, patterns] of Object.entries(patternMap || {})) {
    if (includesAny(text, patterns)) {
      found.push(label);
    }
  }

  return Array.from(new Set(found));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanSlideArtifacts(value: string): string {
  return normalizeText(
    value
      .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
      .replace(/\bstrictly private and confidential\b/gi, " ")
      .replace(/\bproprietary\s*\+\s*confidential\b/gi, " ")
      .replace(/\bpowerpoint presentation\b/gi, " ")
      .replace(/\s+\d+\s*$/g, " ")
  );
}

function extractEvidenceQuotes(text: string): string[] {
  const curlyQuotes = text.match(/“[^”]+”/g) || [];
  const straightQuotes = text.match(/"[^"]+"/g) || [];

  return Array.from(
    new Set(
      [...curlyQuotes, ...straightQuotes]
        .map((quote) => quote.replace(/[“”"]/g, "").trim())
        .filter((quote) => quote.length > 20)
    )
  );
}

function inferPersona(
  text: string,
  profile: ReturnType<typeof getDiseaseProfile>
): string {
  if (includesAny(text, profile.caregiverIndicators || [])) return "caregiver";
  if (includesAny(text, profile.patientIndicators || [])) return "patient";
  if (text.includes("caregiver")) return "caregiver";
  if (text.includes("patient")) return "patient";
  return "unknown";
}

function inferEmotions(text: string): string[] {
  const emotionMap: Record<string, string[]> = {
    anxious: ["anxious", "anxiety", "worried", "worry", "fear", "fearful"],
    confused: ["confused", "confusion", "unclear"],
    frustrated: ["frustrated", "frustration"],
    grief: ["grief", "loss", "lost", "died", "death"],
    guilt: ["guilt", "guilty"],
    uncertain: ["uncertain", "uncertainty", "unknown"],
    distrustful: ["distrust", "skepticism", "skeptical"],
    overwhelmed: ["overwhelmed"],
    hopeful: ["hope", "hopeful"],
    desperate: ["desperate"],
  };

  return extractByPatternMap(text, emotionMap);
}

function inferBarriers(text: string): string[] {
  const barrierMap: Record<string, string[]> = {
    access: ["access", "coverage", "insurance", "eligibility"],
    affordability: ["afford", "cost", "expensive", "price", "financial"],
    clinical_uncertainty: [
      "confusion",
      "unclear",
      "clinical guidance",
      "test results",
      "monitoring",
      "diagnosis",
      "diagnosed",
      "lab markers",
      "viral markers",
      "delayed diagnosis",
    ],
    misinformation: [
      "misinformation",
      "myth",
      "misconception",
      "misconceptions",
      "non-medical cures",
      "alternative treatments",
      "knowledge gaps",
    ],
    trust_gap: [
      "distrust",
      "skepticism",
      "skeptical",
      "institutional",
      "public health guidance",
    ],
    family_impact: [
      "family",
      "mother",
      "father",
      "child",
      "children",
      "loved ones",
      "intergenerational",
    ],
    safety_uncertainty: [
      "safety",
      "side effects",
      "long-term",
      "durability",
      "risk",
      "unknown risks",
    ],
    treatment_burden: [
      "treatment burden",
      "side effect",
      "recovery",
      "procedure",
      "monitoring",
    ],
    logistical_burden: ["travel", "transportation", "appointment", "follow-up"],
  };

  return extractByPatternMap(text, barrierMap);
}

function inferChannels(text: string): string[] {
  const channelMap: Record<string, string[]> = {
    x_twitter: ["x (twitter)", "twitter"],
    reddit: ["reddit"],
    bluesky: ["bluesky"],
    forums: ["forums", "forum"],
    linkedin: ["linkedin"],
    instagram: ["instagram"],
    youtube: ["youtube"],
    blogs: ["blogs", "blog"],
    news: ["news"],
    comments: ["comments"],
    tiktok: ["tiktok"],
    facebook: ["facebook"],
  };

  return extractByPatternMap(text, channelMap);
}

function inferMarkets(text: string): string[] {
  const marketAliases: Record<string, string[]> = {
    united_states: ["united states", "usa", "u.s.", " us "],
    united_kingdom: ["united kingdom", "uk", " u.k."],
    canada: ["canada"],
    australia: ["australia"],
    india: ["india"],
    germany: ["germany"],
    austria: ["austria"],
    spain: ["spain"],
    france: ["france"],
    italy: ["italy"],
    nigeria: ["nigeria"],
    ghana: ["ghana"],
    cameroon: ["cameroon"],
    south_africa: ["south africa"],
    switzerland: ["switzerland"],
    sri_lanka: ["sri lanka"],
    taiwan: ["taiwan"],
    japan: ["japan"],
    china: ["china"],
    brazil: ["brazil"],
    mexico: ["mexico"],
    netherlands: ["netherlands"],
    belgium: ["belgium"],
    bulgaria: ["bulgaria"],
    czech_republic: ["czech republic"],
    finland: ["finland"],
    hungary: ["hungary"],
    lithuania: ["lithuania"],
    norway: ["norway"],
    poland: ["poland"],
    portugal: ["portugal"],
    sweden: ["sweden"],
  };

  const padded = ` ${text.toLowerCase()} `;
  const found: string[] = [];

  for (const [market, aliases] of Object.entries(marketAliases)) {
    if (aliases.some((alias) => padded.includes(` ${alias} `))) {
      found.push(market);
    }
  }

  return Array.from(new Set(found));
}

function inferTheme(text: string): string | undefined {
  const themePatterns: Array<[string, string[]]> = [
    [
      "Clinical uncertainty and care pathway confusion",
      [
        "clinical uncertainty",
        "care pathway",
        "confusion",
        "diagnosis",
        "test results",
        "monitoring",
        "lab markers",
        "viral markers",
      ],
    ],
    [
      "Emotional burden and family impact",
      [
        "emotional burden",
        "family impact",
        "family-centered",
        "grief",
        "guilt",
        "fear",
        "family transmission",
        "intergenerational",
      ],
    ],
    [
      "Peer validation and community interpretation",
      [
        "peer validation",
        "community interpretation",
        "peer forums",
        "community",
        "social platforms",
        "validate",
        "reassurance",
      ],
    ],
    [
      "Access, affordability, and system barriers",
      [
        "access",
        "affordability",
        "coverage",
        "insurance",
        "system barriers",
        "cost",
        "eligibility",
      ],
    ],
    [
      "Safety, permanence, and uncertainty",
      [
        "safety",
        "permanence",
        "long-term",
        "durability",
        "unknown risks",
        "side effects",
      ],
    ],
    [
      "Disease burden and quality of life",
      [
        "disease burden",
        "quality of life",
        "day-to-day",
        "daily life",
        "symptom burden",
      ],
    ],
    [
      "Treatment decision drivers",
      [
        "decision",
        "choice",
        "weighing options",
        "treatment options",
        "risk-benefit",
      ],
    ],
    ["Unmet need", ["unmet need", "unmet needs", "limited options"]],
  ];

  const hit = themePatterns.find(([, patterns]) => includesAny(text, patterns));
  return hit?.[0];
}

function inferFindingType(
  text: string,
  heading: string,
  symptoms: string[],
  treatments: string[]
): CuratedFindingRecord["findingType"] {
  const combined = `${heading} ${text}`.toLowerCase();

  if (
    includesAny(combined, [
      "methodology social listening was performed",
      "boolean query logic",
      "constructed boolean",
      "scraping of the internet",
      "noise exclusions removed",
      "social data culled",
      "research methodology",
      "prepared by",
      "prepared for",
    ])
  ) {
    return "burden";
  }

  if (
    includesAny(combined, [
      "recommendations",
      "recommendation",
      "rationale:",
      "action:",
      "why it matters:",
      "theme alignment:",
      "develop resources",
      "develop myth-busting content",
      "engage directly",
      "create educational materials",
      "amplify real patient stories",
      "provide step-by-step guidance",
    ])
  ) {
    return "recommendation";
  }

  if (
    includesAny(combined, [
      "sample mentions",
      "sample mention",
      "sample quotes",
      "patient quote",
      "caregiver quote",
      "— bluesky",
      "— x",
      "— x (twitter)",
      "— twitter",
      "— reddit",
      "— forum",
      "— forums",
      "— youtube",
      "— instagram",
      "— blog",
    ])
  ) {
    return "evidence_quote";
  }

  if (
    includesAny(combined, [
      "persona",
      "personas",
      "social personas",
      "patient archetype",
      "caregiver-specific",
      "symptomatic:",
      "pregnant:",
      "eventful:",
    ])
  ) {
    return "persona";
  }

  if (
    includesAny(combined, [
      "top sources",
      "platform preference",
      "source preference",
      "channel",
      "channels",
      "where conversations concentrate",
      "where discussion concentrates",
      "peer-driven",
    ])
  ) {
    return "channel_insight";
  }

  if (
    includesAny(combined, [
      "mention trends",
      "mentions trend",
      "top locations",
      "locations",
      "geographic",
      "country",
      "market",
      "territorial insight",
      "conversation drivers",
    ])
  ) {
    return "market_insight";
  }

  if (
    includesAny(combined, [
      "unmet need",
      "unmet needs",
      "barrier",
      "barriers",
      "knowledge gaps",
      "confusion",
      "misinformation",
      "distrust",
      "access failures",
      "delayed diagnosis",
      "lack of understanding",
      "fear of",
      "uncertainty",
      "lack of",
      "gap",
    ])
  ) {
    return "unmet_need";
  }

  if (
    includesAny(combined, [
      "key themes",
      "key theme",
      "what this signals",
      "theme #",
      "prevailing narratives",
      "conversation reflects",
      "emotional burden",
      "family-centered impact",
      "peer validation",
      "community interpretation",
    ])
  ) {
    return "theme";
  }

  if (
    includesAny(combined, [
      "patient lexicon",
      "lexicon",
      "how are people talking",
      "language patterns",
      "vocabulary",
      "how people describe",
      "how are people talking about",
    ])
  ) {
    return "lexicon";
  }

  if (
    includesAny(combined, [
      "safety",
      "side effect",
      "side effects",
      "adverse event",
      "long-term",
      "durability",
      "risk",
    ])
  ) {
    return "safety_signal";
  }

  if (
    includesAny(combined, [
      "decision",
      "choice",
      "choose",
      "weigh",
      "treatment options",
      "risk-benefit",
    ])
  ) {
    return "treatment_decision";
  }

  if (symptoms.length > 0) return "symptom_burden";
  if (treatments.length > 0) return "treatment_decision";

  return "burden";
}

function isJunkBlock(text: string): boolean {
  const lower = text.toLowerCase();

  if (lower.length < 50) return true;

  const isCover =
    lower.includes("prepared by") &&
    lower.includes("prepared for") &&
    !lower.includes("executive summary") &&
    !lower.includes("key themes") &&
    !lower.includes("recommendations");

  const junkPatterns = [
    "prepared by prepared for",
    "powerpoint presentation",
    "table of contents",
    "contents overview methodology",
  ];

  return isCover || includesAny(lower, junkPatterns);
}

function isMethodologyOnly(text: string): boolean {
  const lower = text.toLowerCase();

  const methodologySignals = [
    "methodology",
    "social listening was performed across online sources",
    "boolean query logic",
    "constructed boolean",
    "search strings were developed",
    "partnered with",
    "key terms and hashtags",
    "scraping of the internet",
    "scraped the internet",
    "noise exclusions removed",
    "broad disease terms ensured global coverage",
    "designed to work across social",
  ];

  return (
    includesAny(lower, methodologySignals) &&
    !includesAny(lower, [
      "executive summary",
      "key themes",
      "recommendations",
      "sample mentions",
      "patient lexicon",
      "platform preference",
      "territorial insight",
      "conversation drivers",
    ])
  );
}

async function runPdfParse(buffer: Buffer): Promise<{ text: string }> {
  const pdfParseModule = require("pdf-parse");
  const callable = pdfParseModule.default || pdfParseModule.pdf || pdfParseModule;

  if (typeof callable === "function") {
    return callable(buffer);
  }

  if (pdfParseModule.PDFParse) {
    const parser = new pdfParseModule.PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return { text: result.text || "" };
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    }
  }

  throw new Error(
    `Unsupported pdf-parse export shape. Available keys: ${Object.keys(
      pdfParseModule
    ).join(", ")}`
  );
}

async function extractPagesFromPdf(pdfPath: string): Promise<PageExtraction[]> {
  const buffer = fs.readFileSync(pdfPath);
  const data = await runPdfParse(buffer);

  const rawPages = data.text
    .split(/\f/g)
    .map((page) => cleanSlideArtifacts(page))
    .filter(Boolean);

  if (rawPages.length > 1) {
    return rawPages.map((text, index) => ({
      pageNumber: index + 1,
      text,
    }));
  }

  const fallbackChunks = cleanSlideArtifacts(data.text)
    .split(
      /(?=\b(?:Overview|Methodology|Executive Summary|Mention Trends|Mentions Trend|Top Sources|Key Themes|Key Theme|Recommendations|Recommendation|Patient Lexicon|Platform Preference|Territorial Insight|Conversation Drivers|Global Insights|Messaging Opportunities|Unmet Needs|Social Personas|Sample Mentions|Sample mentions|How are people talking|What this signals|What does this mean|Rationale:|Action:|Why it matters:)\b)/g
    )
    .map((chunk) => cleanSlideArtifacts(chunk))
    .filter((chunk) => chunk.length > 40);

  return fallbackChunks.map((text, index) => ({
    pageNumber: index + 1,
    text,
  }));
}

function splitIntoSemanticBlocks(pages: PageExtraction[]): SemanticBlock[] {
  const blocks: SemanticBlock[] = [];
  let blockNumber = 1;

  const headingRegex =
    /(?=\b(?:Executive Summary|Mention Trends|Mentions Trend|Top Sources|Key Themes|Key Theme|Recommendations|Recommendation|Patient Lexicon|Platform Preference|Territorial Insight|Conversation Drivers|Global Insights|Messaging Opportunities|Unmet Needs|Social Personas|Sample Mentions|Sample mentions|How are people talking|What this signals|What does this mean|Rationale:|Action:|Why it matters:)\b)/g;

  for (const page of pages) {
    const chunks = page.text
      .split(headingRegex)
      .map((chunk) => cleanSlideArtifacts(chunk))
      .filter((chunk) => chunk.length > 40);

    for (const chunk of chunks) {
      if (isJunkBlock(chunk)) continue;
      if (isMethodologyOnly(chunk)) continue;

      const heading = cleanSlideArtifacts(chunk.split(/[.:]/)[0]).slice(0, 160);

      blocks.push({
        blockNumber,
        sourcePageNumber: page.pageNumber,
        heading,
        text: chunk,
      });

      blockNumber += 1;
    }
  }

  return blocks;
}

function extractRecommendationDetails(text: string): {
  rationale?: string;
  action?: string;
  whyItMatters?: string;
  linkedThemes?: string[];
} {
  const rationale = normalizeText(
    text.match(/rationale:\s*([^]+?)(?:action:|why it matters:|theme alignment:|$)/i)?.[1] || ""
  );

  const action = normalizeText(
    text.match(/action:\s*([^]+?)(?:why it matters:|theme alignment:|$)/i)?.[1] || ""
  );

  const whyItMatters = normalizeText(
    text.match(/why it matters:\s*([^]+?)(?:theme alignment:|$)/i)?.[1] || ""
  );

  const themeAlignment = normalizeText(
    text.match(/theme alignment:\s*([^]+?)(?:\d{2}|$)/i)?.[1] || ""
  );

  return {
    rationale,
    action,
    whyItMatters,
    linkedThemes: themeAlignment ? [themeAlignment] : [],
  };
}

function hasInsightSignal(
  text: string,
  profile: ReturnType<typeof getDiseaseProfile>
): boolean {
  return (
    includesAny(text, profile.diseaseNames || []) ||
    includesAny(text, Object.values(profile.symptomPatterns || {}).flat()) ||
    includesAny(text, Object.values(profile.treatmentPatterns || {}).flat()) ||
    includesAny(text, profile.burdenTerms || []) ||
    includesAny(text, [
      "recommendation",
      "theme",
      "what this signals",
      "patient lexicon",
      "platform preference",
      "top sources",
      "top locations",
      "territorial insight",
      "sample mentions",
      "executive summary",
      "persona",
      "unmet need",
      "barrier",
      "rationale:",
      "action:",
      "why it matters:",
      "evidence",
      "quote",
      "confusion",
      "misinformation",
      "distrust",
      "access",
    ])
  );
}

function makeRecord(
  block: SemanticBlock,
  profileId: string,
  sourceDocument: string
): CuratedFindingRecord | null {
  const profile = getDiseaseProfile(profileId);
  const cleanedText = cleanSlideArtifacts(block.text);
  const lower = cleanedText.toLowerCase();

  if (isJunkBlock(cleanedText)) return null;
  if (isMethodologyOnly(cleanedText)) return null;

  const symptoms = extractByPatternMap(lower, profile.symptomPatterns || {});
  const treatments = extractByPatternMap(lower, profile.treatmentPatterns || {});
  const findingType = inferFindingType(lower, block.heading, symptoms, treatments);

  if (findingType === "burden" && isMethodologyOnly(cleanedText)) return null;

  const evidenceQuotes = extractEvidenceQuotes(cleanedText);
  const theme = inferTheme(lower);
  const hasRealSignal = hasInsightSignal(lower, profile);

  if (!hasRealSignal) return null;

  const barriers = findingType !== "burden" ? inferBarriers(lower) : [];
  const emotions = findingType !== "burden" ? inferEmotions(lower) : [];

  const channels =
    ["channel_insight", "market_insight", "evidence_quote", "theme"].includes(
      findingType
    )
      ? inferChannels(lower)
      : [];

  const markets =
    ["market_insight", "channel_insight", "theme"].includes(findingType)
      ? inferMarkets(lower)
      : [];

  const recommendationDetails =
    findingType === "recommendation"
      ? extractRecommendationDetails(cleanedText)
      : {};

  const labels = Array.from(
    new Set([
      findingType,
      ...(theme ? [theme] : []),
      ...symptoms,
      ...treatments,
      ...barriers,
      ...channels,
      ...emotions,
    ])
  );

  return {
    id: `${profileId}_${block.sourcePageNumber}_${block.blockNumber}_${slugify(
      block.heading
    )}`,
    findingType,
    title: block.heading || `Finding ${block.blockNumber}`,
    summary: cleanedText.slice(0, 1200),

    therapeuticArea: profile.therapeuticArea,
    diseaseArea: profile.profileId,
    profileId,

    theme,
    subtheme: undefined,

    persona: inferPersona(lower, profile),
    personaTraits: emotions,
    lifecycleStage: lower.includes("monitoring")
      ? "monitoring"
      : lower.includes("diagnosis")
      ? "diagnosis"
      : lower.includes("family")
      ? "family"
      : lower.includes("pregnancy")
      ? "pregnancy"
      : lower.includes("treatment")
      ? "treatment"
      : undefined,

    symptoms,
    treatments,
    barriers,
    emotions,
    unmetNeeds: barriers,

    channels,
    markets,
    countries: markets,

    labels,
    lexiconExamples: findingType === "lexicon" ? evidenceQuotes : [],
    evidenceQuotes,

    rationale: recommendationDetails.rationale,
    action: recommendationDetails.action,
    whyItMatters: recommendationDetails.whyItMatters,
    linkedThemes:
      recommendationDetails.linkedThemes && recommendationDetails.linkedThemes.length > 0
        ? recommendationDetails.linkedThemes
        : theme
        ? [theme]
        : [],

    sourceType: "curated",
    sourceFormat: "pdf",
    sourceDocument,
    sourceSlideOrPage: `page_${block.sourcePageNumber}_block_${block.blockNumber}`,

    platform: "curated_pdf",
    country: "",
    url: "",
    confidence: 0.9,
  };
}

function convertPagesToCurated(
  pages: PageExtraction[],
  profileId: string,
  sourceDocument: string
): CuratedFindingRecord[] {
  const profile = getDiseaseProfile(profileId);
  const blocks = splitIntoSemanticBlocks(pages);

  return blocks
    .map((block) => makeRecord(block, profileId, sourceDocument))
    .filter((record): record is CuratedFindingRecord => Boolean(record))
    .filter((record) => {
      const summary = cleanSlideArtifacts(record.summary).toLowerCase();

      if (summary.length < 80) return false;
      if (isMethodologyOnly(summary)) return false;

      if (record.findingType === "burden" && !hasInsightSignal(summary, profile)) {
        return false;
      }

      return hasInsightSignal(summary, profile);
    });
}

async function main() {
  const [, , pdfPathArg, profileIdArg, outputPathArg] = process.argv;

  if (!pdfPathArg || !profileIdArg) {
    console.error(
      "Usage:\n" +
        "npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' src/ingestion/curated/convertPdfToCurated.ts <pdfPath> <profileId> [outputPath]"
    );
    process.exit(1);
  }

  const pdfPath = path.resolve(pdfPathArg);
  const profileId = profileIdArg;
  const outputPath = outputPathArg
    ? path.resolve(outputPathArg)
    : path.resolve(__dirname, `${profileId}.json`);

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  getDiseaseProfile(profileId);

  const pages = await extractPagesFromPdf(pdfPath);
  const curated = convertPagesToCurated(
    pages,
    profileId,
    path.basename(pdfPath)
  );

  fs.writeFileSync(outputPath, JSON.stringify(curated, null, 2), "utf8");

  console.log(`Extracted ${pages.length} pages/chunks`);
  console.log(`Wrote ${curated.length} curated findings`);
  console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});