import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { getDiseaseProfile } from "../profiles";
import { CuratedFindingRecord } from "./index";

type SlideExtraction = {
  slideNumber: number;
  title: string;
  text: string;
  notes: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeText(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase.toLowerCase()));
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

function flattenTextNodes(node: any): string[] {
  if (node == null) return [];

  if (typeof node === "string") {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(flattenTextNodes);
  }

  if (typeof node === "object") {
    const out: string[] = [];
    for (const [, value] of Object.entries(node)) {
      out.push(...flattenTextNodes(value));
    }
    return out;
  }

  return [];
}

function extractTitleFromText(text: string): string {
  const lines = text
    .split(/[\n\r]+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  if (lines.length === 0) return "";
  return lines[0].slice(0, 140);
}

async function readZipXml(zip: JSZip, filePath: string): Promise<any | null> {
  const file = zip.file(filePath);
  if (!file) return null;

  const xml = await file.async("string");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
  });

  return parser.parse(xml);
}

async function extractSlidesFromPptx(pptxPath: string): Promise<SlideExtraction[]> {
  const buffer = fs.readFileSync(pptxPath);
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const aNum = Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0);
      const bNum = Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0);
      return aNum - bNum;
    });

  const slides: SlideExtraction[] = [];

  for (const slideFile of slideFiles) {
    const slideNum = Number(slideFile.match(/slide(\d+)\.xml$/)?.[1] || 0);
    const slideXml = await readZipXml(zip, slideFile);

    const slideTexts = flattenTextNodes(slideXml);
    const slideText = normalizeText(slideTexts.join(" "));

    const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`;
    const notesXml = await readZipXml(zip, notesPath);
    const notesTexts = flattenTextNodes(notesXml);
    const notesText = normalizeText(notesTexts.join(" "));

    const combinedForTitle = normalizeText(`${slideText} ${notesText}`);
    const title = extractTitleFromText(combinedForTitle);

    slides.push({
      slideNumber: slideNum,
      title,
      text: slideText,
      notes: notesText,
    });
  }

  return slides;
}

function inferPersona(
  text: string,
  profile: ReturnType<typeof getDiseaseProfile>
): string {
  if (includesAny(text, profile.caregiverIndicators || [])) return "caregiver";
  if (includesAny(text, profile.patientIndicators || [])) return "patient";
  return "unknown";
}

function inferEmotions(text: string): string[] {
  const emotionMap: Record<string, string[]> = {
    anxious: ["anxious", "anxiety", "worried", "worry", "fear", "fearful"],
    hopeful: ["hope", "hopeful"],
    frustrated: ["frustrated", "frustration"],
    overwhelmed: ["overwhelmed"],
    desperate: ["desperate"],
    uncertain: ["uncertain", "uncertainty", "unknown"],
    grief: ["grief", "grieving", "loss"],
    guilt: ["guilt", "guilty"],
  };

  return extractByPatternMap(text, emotionMap);
}

function inferBarrierLabels(text: string): string[] {
  const barrierMap: Record<string, string[]> = {
    cost: ["cost", "expensive", "afford", "affordability", "pricing"],
    access: ["access", "eligibility", "coverage", "insurance", "payer"],
    geography: ["travel", "distance", "center", "site of care"],
    regulatory: ["regulatory", "approval", "medicaid", "coverage policy"],
    safety_uncertainty: ["uncertainty", "long-term", "durability", "unknown risks"],
  };

  return extractByPatternMap(text, barrierMap);
}

function inferChannels(text: string): string[] {
  const channelMap: Record<string, string[]> = {
    x_twitter: ["x (twitter)", "twitter", "x "],
    reddit: ["reddit"],
    youtube: ["youtube"],
    linkedin: ["linkedin"],
    instagram: ["instagram"],
    forums: ["forum", "forums"],
    blogs: ["blog", "blogs"],
    bluesky: ["bluesky"],
    news: ["news"],
    comments: ["comments"],
  };

  return extractByPatternMap(text, channelMap);
}

function inferMarkets(text: string): string[] {
  const markets = [
    "united states",
    "us",
    "uk",
    "canada",
    "india",
    "australia",
    "germany",
    "austria",
    "spain",
    "nigeria",
    "ghana",
    "italy",
    "cameroon",
    "south africa",
    "switzerland",
    "sri lanka",
    "maryland",
    "taiwan",
  ];

  return Array.from(
    new Set(markets.filter((market) => text.includes(market)))
  );
}

function inferFindingType(
  text: string,
  title: string,
  symptoms: string[],
  treatments: string[]
): CuratedFindingRecord["findingType"] {
  const combined = `${title} ${text}`;

  if (
    combined.includes("recommendation") ||
    combined.includes("action:") ||
    combined.includes("why it matters") ||
    combined.includes("how to execute")
  ) {
    return "recommendation";
  }

  if (
    combined.includes("sample mentions") ||
    combined.includes("— x") ||
    combined.includes("— bluesky") ||
    combined.includes("— youtube") ||
    combined.includes("— blog")
  ) {
    return "evidence_quote";
  }

  if (
    combined.includes("persona") ||
    combined.includes("caregiver-specific") ||
    combined.includes("symptomatic:") ||
    combined.includes("pregnant:") ||
    combined.includes("eventful:")
  ) {
    return "persona";
  }

  if (
    combined.includes("top sources") ||
    combined.includes("platform preference") ||
    combined.includes("where ") && combined.includes("concentrate by theme and channel")
  ) {
    return "channel_insight";
  }

  if (
    combined.includes("top locations") ||
    combined.includes("territorial insight") ||
    combined.includes("conversation drivers")
  ) {
    return "market_insight";
  }

  if (
    combined.includes("patient lexicon") ||
    combined.includes("how are people talking") ||
    combined.includes("lexicon")
  ) {
    return "lexicon";
  }

  if (
    combined.includes("unmet need") ||
    combined.includes("access barriers") ||
    combined.includes("structural inequity") ||
    combined.includes("barrier")
  ) {
    return "unmet_need";
  }

  if (
    combined.includes("safety") ||
    combined.includes("side effect") ||
    combined.includes("long-term") ||
    combined.includes("durability") ||
    combined.includes("permanence")
  ) {
    return "safety_signal";
  }

  if (
    combined.includes("theme") ||
    combined.includes("what this signals") ||
    combined.includes("conditional hope") ||
    combined.includes("clinical uncertainty") ||
    combined.includes("peer validation")
  ) {
    return "theme";
  }

  if (
    combined.includes("decision") ||
    combined.includes("choose") ||
    combined.includes("choice")
  ) {
    return "treatment_decision";
  }

  if (symptoms.length > 0) {
    return "symptom_burden";
  }

  if (treatments.length > 0) {
    return "treatment_decision";
  }

  return "burden";
}

function inferTheme(title: string, text: string): string | undefined {
  const combined = `${title} ${text}`;

  const themes = [
    "disease burden",
    "conditional hope",
    "safety",
    "permanence",
    "uncertainty",
    "access",
    "cost",
    "system barriers",
    "clinical uncertainty",
    "care pathway confusion",
    "emotional burden",
    "family-centered impact",
    "peer validation",
    "community interpretation",
  ];

  const hit = themes.find((theme) => combined.includes(theme));
  return hit || undefined;
}

function inferPersonaTraits(text: string): string[] {
  const traitMap: Record<string, string[]> = {
    anxious: ["anxious", "anxiety"],
    hopeful: ["hopeful", "hope"],
    overwhelmed: ["overwhelmed"],
    frustrated: ["frustrated"],
    thoughtful: ["thoughtful"],
    exhausted: ["exhausted"],
    depressed: ["depressed"],
    timid: ["timid"],
    worried: ["worried"],
    desperate: ["desperate"],
    vulnerable: ["vulnerable"],
    apprehensive: ["apprehensive"],
    confused: ["confused"],
    determined: ["determined"],
    skeptical: ["skeptical"],
  };

  return extractByPatternMap(text, traitMap);
}

function inferLifecycleStage(text: string): string | undefined {
  if (text.includes("pregnant") || text.includes("pregnancy")) return "pregnancy";
  if (text.includes("caregiver") || text.includes("my child")) return "caregiving";
  if (text.includes("diagnosed")) return "diagnosis";
  if (text.includes("treatment")) return "treatment";
  if (text.includes("recovery") || text.includes("follow-up")) return "follow_up";
  if (text.includes("menopause")) return "menopause";
  return undefined;
}

function inferLabels(
  text: string,
  symptoms: string[],
  treatments: string[],
  findingType: string
): string[] {
  const labels = new Set<string>();

  symptoms.forEach((s) => labels.add(s));
  treatments.forEach((t) => labels.add(t));
  labels.add(findingType);

  if (text.includes("monitor")) labels.add("monitoring");
  if (text.includes("follow-up") || text.includes("follow up")) labels.add("follow_up");
  if (text.includes("travel")) labels.add("travel");
  if (text.includes("access")) labels.add("access");
  if (text.includes("caregiver")) labels.add("caregiver");
  if (text.includes("family")) labels.add("family");
  if (text.includes("uncertainty")) labels.add("uncertainty");
  if (text.includes("recovery")) labels.add("recovery");
  if (text.includes("affordability") || text.includes("cost")) labels.add("cost");
  if (text.includes("vaccine")) labels.add("vaccine");
  if (text.includes("fertility")) labels.add("fertility");

  return Array.from(labels);
}

function extractEvidenceQuotes(text: string): string[] {
  const matches = text.match(/“[^”]+”/g) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/[“”]/g, "").trim())));
}

function shouldKeepSlide(
  slide: SlideExtraction,
  profile: ReturnType<typeof getDiseaseProfile>
): boolean {
  const combined = normalizeText(`${slide.title} ${slide.text} ${slide.notes}`).toLowerCase();

  if (!combined || combined.length < 40) return false;

  const mentionsDisease = includesAny(combined, profile.diseaseNames || []);
  const mentionsSymptom = includesAny(
    combined,
    Object.values(profile.symptomPatterns || {}).flat()
  );
  const mentionsTreatment = includesAny(
    combined,
    Object.values(profile.treatmentPatterns || {}).flat()
  );
  const mentionsBurden = includesAny(combined, profile.burdenTerms || []);

  const broadStrategicSignals = [
    "recommendation",
    "theme",
    "what this signals",
    "patient lexicon",
    "platform preference",
    "top sources",
    "top locations",
    "conversation drivers",
    "territorial insight",
    "sample mentions",
    "executive summary",
    "unmet need",
    "persona",
  ];

  return (
    mentionsDisease ||
    mentionsSymptom ||
    mentionsTreatment ||
    mentionsBurden ||
    includesAny(combined, broadStrategicSignals)
  );
}

function convertSlidesToCurated(
  slides: SlideExtraction[],
  profileId: string,
  sourceDocument: string
): CuratedFindingRecord[] {
  const profile = getDiseaseProfile(profileId);

  return slides
    .filter((slide) => shouldKeepSlide(slide, profile))
    .map((slide): CuratedFindingRecord => {
      const combined = normalizeText(
        `${slide.title} ${slide.text} ${slide.notes}`
      ).toLowerCase();

      const symptoms = extractByPatternMap(combined, profile.symptomPatterns || {});
      const treatments = extractByPatternMap(combined, profile.treatmentPatterns || {});
      const findingType = inferFindingType(combined, slide.title, symptoms, treatments);
      const persona = inferPersona(combined, profile);
      const theme = inferTheme(slide.title.toLowerCase(), combined);
      const personaTraits = inferPersonaTraits(combined);
      const lifecycleStage = inferLifecycleStage(combined);
      const channels = inferChannels(combined);
      const markets = inferMarkets(combined);
      const barriers = inferBarrierLabels(combined);
      const emotions = inferEmotions(combined);
      const evidenceQuotes = extractEvidenceQuotes(`${slide.text} ${slide.notes}`);
      const labels = inferLabels(combined, symptoms, treatments, findingType);

      const title = slide.title || `Slide ${slide.slideNumber} insight`;
      const summary = normalizeText(slide.notes || slide.text).slice(0, 1200);

      let rationale = "";
      let action = "";
      let whyItMatters = "";

      if (findingType === "recommendation") {
        const lower = `${slide.text} ${slide.notes}`;
        const actionMatch = lower.match(/action:\s*([^]+?)(?:why it matters:|how to execute:|$)/i);
        const whyMatch = lower.match(/why it matters:\s*([^]+?)(?:how to execute:|theme|$)/i);
        const rationaleMatch = lower.match(/rationale:\s*([^]+?)(?:action:|why it matters:|$)/i);

        action = normalizeText(actionMatch?.[1] || "");
        whyItMatters = normalizeText(whyMatch?.[1] || "");
        rationale = normalizeText(rationaleMatch?.[1] || "");
      }

      return {
        id: `${profileId}_slide_${slide.slideNumber}_${slugify(title)}`,
        findingType,
        title,
        summary,
        therapeuticArea: profile.therapeuticArea,
        diseaseArea: profile.profileId,
        profileId,

        theme,
        subtheme: undefined,

        persona,
        personaTraits,
        lifecycleStage,

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

        rationale,
        action,
        whyItMatters,
        linkedThemes: theme ? [theme] : [],

        sourceType: "curated",
        sourceFormat: "pptx",
        sourceDocument,
        sourceSlideOrPage: `slide_${slide.slideNumber}`,

        country: "",
        platform: "curated_ppt",
        url: "",
        confidence: 0.9,
      };
    })
    .filter((record) => normalizeText(record.summary).length > 0);
}

async function main() {
  const [, , pptxPathArg, profileIdArg, outputPathArg] = process.argv;

  if (!pptxPathArg || !profileIdArg) {
    console.error(
      'Usage:\n' +
        'npx ts-node --compiler-options \'{"module":"CommonJS"}\' src/ingestion/curated/convertPptxToCurated.ts <pptxPath> <profileId> [outputPath]'
    );
    process.exit(1);
  }

  const pptxPath = path.resolve(pptxPathArg);
  const profileId = profileIdArg;
  const outputPath = outputPathArg
    ? path.resolve(outputPathArg)
    : path.resolve(__dirname, `${profileId}.json`);

  if (!fs.existsSync(pptxPath)) {
    throw new Error(`PPTX file not found: ${pptxPath}`);
  }

  getDiseaseProfile(profileId);

  const slides = await extractSlidesFromPptx(pptxPath);
  const curated = convertSlidesToCurated(
    slides,
    profileId,
    path.basename(pptxPath)
  );

  fs.writeFileSync(outputPath, JSON.stringify(curated, null, 2), "utf8");

  console.log(`Extracted ${slides.length} slides`);
  console.log(`Wrote ${curated.length} curated findings`);
  console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});