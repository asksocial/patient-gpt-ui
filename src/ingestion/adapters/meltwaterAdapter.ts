import fs from "fs";
import { IngestionContext } from "../types";
import { DiseaseProfile } from "../profiles";
import {
  preserveRawMetadata,
} from "../metadata";

export type MeltwaterRow = Record<string, any>;

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
  const detected: string[] = [];

  for (const [label, patterns] of Object.entries(patternMap || {})) {
    if (includesAny(text, patterns)) {
      detected.push(label);
    }
  }

  return Array.from(new Set(detected));
}

function extractKnowledgeDomains(
  text: string,
  profile: DiseaseProfile
): string[] {
  const matchedDomains: string[] = [];

  for (const domain of profile.knowledgeDomains || []) {
    const phrases = [
      ...(domain.signalPhrases || []),
      ...(domain.keywords || []),
    ];

    if (includesAny(text, phrases)) {
      matchedDomains.push(domain.name);
    }
  }

  return Array.from(new Set(matchedDomains));
}

function detectPersona(
  text: string,
  tags: string,
  profile: DiseaseProfile
): string {
  const combined = `${text} ${tags}`.toLowerCase();

  if (includesAny(combined, profile.caregiverIndicators || [])) {
    return "caregiver";
  }

  if (includesAny(combined, profile.patientIndicators || [])) {
    return "patient";
  }

  return "unknown";
}

function hasPatientVoice(text: string, profile: DiseaseProfile): boolean {
  return includesAny(text, profile.patientIndicators || []);
}

function hasCaregiverVoice(text: string, profile: DiseaseProfile): boolean {
  return includesAny(text, profile.caregiverIndicators || []);
}

function hasDiseaseContext(text: string, profile: DiseaseProfile): boolean {
  return includesAny(text, profile.diseaseNames || []);
}

function hasBurdenLanguage(text: string, profile: DiseaseProfile): boolean {
  return includesAny(text, profile.burdenTerms || []);
}

function isAestheticsProfile(profile: DiseaseProfile): boolean {
  return (
    profile.profileId === "regenerative_aesthetics" ||
    profile.profileId === "medical_aesthetics" ||
    profile.profileId === "botulinum_toxin"
  );
}

function isBotulinumToxinProfile(profile: DiseaseProfile): boolean {
  return profile.profileId === "botulinum_toxin";
}

function hasBotulinumToxinAnchor(text: string): boolean {
  return includesAny(text, [
    "botulinum toxin", "botulinum neurotoxin", "bont-a", "bonta", "botox", "dysport", "xeomin",
    "jeuveau", "nuceiva", "daxxify", "letybo", "onabotulinum", "abobotulinum", "incobotulinum",
    "prabotulinum", "daxibotulinum", "letibotulinum", "neuromodulator", "neurotoxin injection",
  ]);
}

function shouldExcludeBotulinumToxinRow(text: string): boolean {
  if (!hasBotulinumToxinAnchor(text)) return true;
  return includesAny(text, [
    "liquid botox tea", "botox tea recipe", "hair botox", "botox for hair", "botox shampoo",
    "botox conditioner", "botox hair mask", "botulism outbreak", "foodborne botulism",
  ]);
}

function isEducationalContent(text: string, profile: DiseaseProfile): boolean {
  return (
    includesAny(text, [
      "did you know",
      "join us",
      "learn more",
      "awareness month",
      "raise awareness",
    ]) || includesAny(text, profile.educationalExclusionPatterns || [])
  );
}

function isStatHeavy(text: string): boolean {
  return /\d+%/.test(text) || /\b\d+\s*(million|billion)\b/.test(text);
}

function isLowQualityNoise(text: string, profile: DiseaseProfile): boolean {
  return (
    includesAny(text, profile.lowQualityNoisePatterns || []) ||
    text.startsWith("qt @") ||
    text.startsWith("@")
  );
}

function isHardExcluded(text: string, profile: DiseaseProfile): boolean {
  return includesAny(text, profile.hardExclusionPatterns || []);
}

function isExtraExcluded(text: string, profile: DiseaseProfile): boolean {
  return includesAny(text, profile.extraExclusionPatterns || []);
}

function isCommercialShoppingNoise(text: string): boolean {
  return includesAny(text, [
    "amazon",
    "amzn.to",
    "buy link",
    "shop now",
    "shop on",
    "add to cart",
    "tiktok shop",
    "ltk",
    "liketk",
    "affiliate",
    "#ad",
    "promo code",
    "discount",
    "sale",
    "special launch price",
    "price list",
    "available at",
    "available now",
    "now available",
    "olive young",
    "global.oliveyoung",
    "jastip",
    "handcarry",
    "ready ina",
    "dp280k",
    "wts",
    "wtb",
    "minat dm",
    "order dm",
    "link in bio",
    "link mua",
    "mediafire",
    "download all in one",
  ]);
}

function isPressOrCorporateNoise(text: string): boolean {
  return includesAny(text, [
    "pr newswire",
    "prnewswire",
    "einpresswire",
    "businesswire",
    "business wire",
    "globe newswire",
    "newmediawire",
    "press release",
    "media contact",
    "announces",
    "announced",
    "launches",
    "launching",
    "expands",
    "expansion",
    "strategic investment",
    "secures board representation",
    "appoints",
    "appointed",
    "named ceo",
    "board of directors",
    "series a",
    "series b",
    "financing",
    "acquisition",
    "merger",
    "shareholder",
    "investor",
    "forward-looking statements",
    "nasdaq",
    "form 10-k",
    "form 8-k",
    "clinical-stage",
    "clinical stage",
    "gmp-grade",
    "cmo",
    "cdmo",
    "crdmo",
    "manufacturing contract",
  ]);
}

function isClinicPromoNoise(text: string): boolean {
  return includesAny(text, [
    "call:",
    "phone:",
    "whatsapp",
    "call/whatsapp",
    "book now",
    "book your",
    "appointment",
    "free consultation",
    "contact us",
    "visit us",
    "clinic location",
    "clinic details",
    "address:",
    "near bank",
    "plot no",
    "open jastip",
    "limited offer",
    "dm us",
    "dm me",
    "comment booty",
    "tap our link",
    "online booking",
    "course",
    "training program",
    "academy",
    "enroll now",
    "webinar",
    "symposium",
    "masterclass",
  ]);
}

function isCelebrityFanNoise(text: string): boolean {
  return includesAny(text, [
    "brand ambassador",
    "global ambassador",
    "regional ambassador",
    "friend of amazing thailand",
    "prada beauty",
    "winmetawin",
    "kimsejeong",
    "sejeong",
    "beckysangels",
    "ba of",
    "presenter of",
    "fanclub",
    "fan club",
    "dinner on a yacht",
    "the grand gambit",
  ]);
}

function isHairOrNonFacialTreatmentNoise(text: string): boolean {
  return includesAny(text, [
    "hair transplant",
    "hair restoration",
    "hair regrowth",
    "hair growth",
    "hair fall",
    "hair loss",
    "thinning hair",
    "hair thinning",
    "scalp",
    "alopecia",
    "androgenetic alopecia",
    "beard transplant",
    "fue",
    "dhi",
    "hybrid",
    "hairline",
    "roots clinic",
    "prp hair",
    "hair prp",
    "prp therapy for hair",
    "scalp micropigmentation",
    "haircare",
    "hair care",
    "rosemary hair",
    "vaginal rejuvenation",
    "erectile dysfunction",
    "urology",
    "fertility",
    "ovarian",
    "endometrial",
    "knee",
    "orthopedic",
    "orthopaedic",
    "sports medicine",
    "joint pain",
    "osteoarthritis",
    "tinnitus",
    "hearing loss",
    "autism",
    "duchenne",
    "cns",
    "central nervous system",
    "ophthalmology",
    "eye drops",
    "long covid",
    "covid injections",
  ]);
}

function hasAestheticAnchor(text: string): boolean {
  return includesAny(text, [
    "regenerative aesthetics",
    "regenerative esthetics",
    "aesthetic",
    "aesthetics",
    "esthetic",
    "esthetics",
    "beauty",
    "skincare",
    "skin care",
    "skin",
    "face",
    "facial",
    "dermatology",
    "dermatologist",
    "cosmetic",
    "cosmetics",
    "med spa",
    "medspa",
    "injectable",
    "injectables",
    "botox",
    "filler",
    "fillers",
    "sculptra",
    "radiesse",
    "skin booster",
    "skin boosters",
    "rejuran",
    "juvelook",
    "pdrn",
    "polynucleotide",
    "polynucleotides",
    "exosome skincare",
    "exosome facial",
    "prp facial",
    "prf facial",
    "vampire facial",
    "microneedling",
    "laser",
    "glow",
    "wrinkle",
    "wrinkles",
    "collagen",
    "rejuvenation",
    "natural results",
    "skin quality",
    "glass skin",
    "anti-aging",
    "anti aging",
    "skin longevity",
  ]);
}

function hasMarketSignal(text: string): boolean {
  return includesAny(text, [
    "interest",
    "growing interest",
    "demand",
    "trend",
    "trending",
    "buzzy",
    "buzz",
    "hype",
    "worth it",
    "why i love",
    "game changer",
    "must-have",
    "must have",
    "results",
    "before and after",
    "natural results",
    "visible results",
    "clinical results",
    "science-backed",
    "clinically proven",
    "education",
    "confused",
    "confusing",
    "skeptical",
    "safety",
    "downtime",
    "cost",
    "price",
    "market",
    "opportunity",
    "white space",
    "innovation",
    "adoption",
    "awareness",
    "consumer",
    "consumers",
    "patients",
    "clients",
    "skin quality",
    "skin longevity",
  ]);
}

function hasStrongConsumerOrProviderSignal(text: string): boolean {
  return includesAny(text, [
    "i tried",
    "i got",
    "i had",
    "i've been loving",
    "i’ve been loving",
    "i love",
    "my skin",
    "my face",
    "my results",
    "my routine",
    "patients ask",
    "clients ask",
    "my patient",
    "my client",
    "our patients",
    "our clients",
    "as a dermatologist",
    "as an injector",
    "as a provider",
    "in my clinic",
    "in our clinic",
    "when patients ask",
    "before and after",
    "worth it",
    "confused between",
    "help me choose",
  ]);
}

function shouldExcludeAestheticsRow(text: string): boolean {
  if (!hasAestheticAnchor(text)) return true;
  if (isHairOrNonFacialTreatmentNoise(text)) return true;

  const marketSignal = hasMarketSignal(text);
  const humanSignal = hasStrongConsumerOrProviderSignal(text);

  if (isCelebrityFanNoise(text)) return true;
  if (isCommercialShoppingNoise(text)) return true;
  if (isPressOrCorporateNoise(text)) return true;
  if (isClinicPromoNoise(text) && !humanSignal) return true;

  if (
    includesAny(text, [
      "market report",
      "industry report",
      "forecast period",
      "selected companies",
      "competitive landscape",
      "chapter 1",
      "chapter 2",
      "chapter 3",
      "quarterly revenue",
      "annual revenue",
      "market size",
      "market share",
      "earnings",
      "investor relations",
      "conference call",
      "best stem cell clinics",
      "clinic expands",
      "grand opening",
      "new location",
      "clinic hotline",
      "luxury facials",
      "best facial spas",
      "price list",
      "course fee",
      "training academy",
      "certification course",
      "register now",
      "available worldwide",
      "global distributor",
      "wholesale",
      "retailer",
      "reseller",
      "authorized seller",
    ])
  ) {
    return true;
  }

  if (!marketSignal && !humanSignal) return true;

  return false;
}

function chooseSummary(row: MeltwaterRow): string {
  const hit = normalizeText(row["Hit Sentence"] || "");
  const open = normalizeText(row["Opening Text"] || "");
  const title = normalizeText(row["Title"] || row["Headline"] || "");

  if (hit) return hit;
  if (open) return open.slice(0, 220);
  return title;
}

function inferFindingType(
  text: string,
  symptoms: string[],
  treatments: string[],
  burden: boolean,
  patientVoice: boolean,
  caregiverVoice: boolean,
  profile: DiseaseProfile
): string {
  if (isAestheticsProfile(profile)) {
    if (
      includesAny(text, [
        "confused",
        "confusing",
        "what is",
        "skeptical",
        "safety",
        "risk",
        "side effects",
        "downtime",
        "worth it",
        "cost",
        "price",
        "education",
        "learn",
        "misconception",
        "misconceptions",
      ])
    ) {
      return "education_barrier";
    }

    if (
      includesAny(text, [
        "botox",
        "filler",
        "fillers",
        "laser",
        "microneedling",
        "chemical peel",
        "hydrafacial",
        "facelift",
        "surgery",
        "retinol",
        "serum",
        "skincare routine",
        "ultherapy",
        "morpheus8",
        "hifu",
        "sofwave",
      ])
    ) {
      return "competitive_alternative";
    }

    if (
      includesAny(text, [
        "natural results",
        "visible results",
        "before and after",
        "game changer",
        "must-have",
        "must have",
        "why i love",
        "glow",
        "glass skin",
        "smooth",
        "hydration",
        "collagen",
        "long-lasting",
        "long lasting",
        "minimal downtime",
        "clinically proven",
        "science-backed",
        "skin quality",
        "skin longevity",
      ])
    ) {
      return "adoption_driver";
    }

    if (
      includesAny(text, [
        "growing demand",
        "strong demand",
        "growing interest",
        "trend",
        "trending",
        "buzzy",
        "buzz",
        "market",
        "opportunity",
        "white space",
        "innovation",
        "consumer",
        "consumers",
        "adoption",
        "awareness",
      ])
    ) {
      return "market_interest";
    }

    if (treatments.length > 0 || burden || patientVoice || caregiverVoice) {
      return "market_interest";
    }
  }

  if (symptoms.length > 0) return "symptom_burden";
  if (treatments.length > 0) return "treatment_concern";
  if (burden) return "quality_of_life";

  return "other";
}

function makeLabels(findingType: string): string[] {
  if (findingType === "education_barrier") return ["education", "barrier"];
  if (findingType === "competitive_alternative") return ["competitive", "alternative"];
  if (findingType === "adoption_driver") return ["adoption", "driver"];
  if (findingType === "market_interest") return ["market", "interest"];
  if (findingType === "market_opportunity") return ["market", "opportunity"];
  if (findingType === "symptom_burden") return ["symptom"];
  if (findingType === "treatment_concern") return ["treatment"];
  if (findingType === "quality_of_life") return ["quality_of_life"];
  return ["other"];
}

export function parseMeltwaterCsv(filePath: string): MeltwaterRow[] {
  const buffer = fs.readFileSync(filePath);
  const content = buffer.toString("utf16le");

  const lines = content
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return [];

  const headers = lines[0].split("\t").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    const row: MeltwaterRow = {};

    headers.forEach((header, i) => {
      row[header] = values[i] ?? "";
    });

    return row;
  });
}

export function adaptMeltwaterRows(
  rows: MeltwaterRow[],
  context: IngestionContext & { profile: DiseaseProfile }
): any[] {
  const profile = context.profile;
  const relevancePrequalified = context.relevancePolicy === "prequalified";

  return rows
    .map((row) => {
      const rawMetadata =
        preserveRawMetadata(
          row,
          {
            adapter:
              "meltwater",

            sourceProvider:
              "meltwater",

            /**
             * Add normalized field names here only when
             * a future export contains credentials,
             * access tokens, or other fields that should
             * never be retained.
             */
            excludedFields: [],
          }
        );

      const title = normalizeText(row["Title"] || row["Headline"] || "");
      const opening = normalizeText(row["Opening Text"] || "");
      const hit = normalizeText(row["Hit Sentence"] || "");
      const tags = normalizeText(row["Document Tags"] || "");

      const combinedText = `${title} ${opening} ${hit}`.toLowerCase();

      if (!combinedText || combinedText.length < 20) return null;

      if (!relevancePrequalified) {
        if (
          isBotulinumToxinProfile(profile)
            ? combinedText.includes("vaccine") || combinedText.includes("vitamin k")
            : combinedText.includes("vaccine") || combinedText.includes("shot") || combinedText.includes("jab") || combinedText.includes("vitamin k")
        ) {
          return null;
        }

        if (isHardExcluded(combinedText, profile)) return null;
        if (isExtraExcluded(combinedText, profile)) return null;
        if (isLowQualityNoise(combinedText, profile)) return null;

        if (isBotulinumToxinProfile(profile) && shouldExcludeBotulinumToxinRow(combinedText)) {
          return null;
        }

        if (
          isAestheticsProfile(profile) &&
          !isBotulinumToxinProfile(profile) &&
          shouldExcludeAestheticsRow(combinedText)
        ) {
          return null;
        }
      }

      const rawSymptoms = extractByPatternMap(
        combinedText,
        profile.symptomPatterns || {}
      );

      const treatments = extractByPatternMap(
        combinedText,
        profile.treatmentPatterns || {}
      );

      const knowledgeDomains = extractKnowledgeDomains(combinedText, profile);

      const burden = hasBurdenLanguage(combinedText, profile);
      const patientVoice = hasPatientVoice(combinedText, profile);
      const caregiverVoice = hasCaregiverVoice(combinedText, profile);
      const marketSignal = hasMarketSignal(combinedText);

      const symptoms = isAestheticsProfile(profile)
        ? rawSymptoms
        : rawSymptoms.filter((symptom) => {
            if (!patientVoice && !burden) return false;
            if (symptom === "jaundice" && !patientVoice && !burden) return false;
            return true;
          });

      if (!relevancePrequalified &&
        isEducationalContent(combinedText, profile) &&
        symptoms.length === 0 &&
        treatments.length === 0 &&
        knowledgeDomains.length === 0 &&
        !burden &&
        !patientVoice &&
        !caregiverVoice &&
        !marketSignal
      ) {
        return null;
      }

      if (!relevancePrequalified &&
        isStatHeavy(combinedText) &&
        symptoms.length === 0 &&
        treatments.length === 0 &&
        knowledgeDomains.length === 0 &&
        !patientVoice &&
        !isAestheticsProfile(profile)
      ) {
        return null;
      }

      if (!relevancePrequalified &&
        profile.requireDiseaseContextForSymptoms &&
        !hasDiseaseContext(combinedText, profile)
      ) {
        return null;
      }

      if (!relevancePrequalified && isAestheticsProfile(profile)) {
        if (
          symptoms.length === 0 &&
          treatments.length === 0 &&
          knowledgeDomains.length === 0 &&
          !burden &&
          !patientVoice &&
          !caregiverVoice &&
          !marketSignal
        ) {
          return null;
        }
      } else if (!relevancePrequalified) {
        if (
          symptoms.length === 0 &&
          treatments.length === 0 &&
          knowledgeDomains.length === 0 &&
          !burden &&
          !patientVoice &&
          !caregiverVoice
        ) {
          return null;
        }
      }

      if (!relevancePrequalified &&
        !isAestheticsProfile(profile) &&
        symptoms.length > 0 &&
        !patientVoice &&
        !caregiverVoice
      ) {
        return null;
      }

      const persona = detectPersona(combinedText, tags, profile);

      if (!relevancePrequalified && !isAestheticsProfile(profile)) {
        if (persona === "caregiver" && symptoms.length === 0) {
          return null;
        }
      }

      const summary = chooseSummary(row);
      if (!summary) return null;

      const findingType = inferFindingType(
        combinedText,
        symptoms,
        treatments,
        burden,
        patientVoice,
        caregiverVoice,
        profile
      );

        return {
        id:
          row["Document ID"] ||
          Math.random()
            .toString(36)
            .slice(2),

        findingType,

        rawMetadata,
        title,
        summary,
        description: summary,
        text: opening,
        excerpt: hit,
        labels: makeLabels(findingType),
        symptoms,
        treatments,
        knowledgeDomains,
        country: normalizeText(row["Country"] || ""),
        platform: normalizeText(row["Source Type"] || row["Source"] || ""),
        persona,
        url: normalizeText(row["URL"] || ""),
        sourceType: "live",
        sourceId: row["Document ID"],
        therapeuticArea: profile.therapeuticArea,
        score: Number(row["Engagement"] || 0),
        confidence:
          symptoms.length > 0 ||
          treatments.length > 0 ||
          knowledgeDomains.length > 0 ||
          marketSignal
            ? 0.85
            : 0.7,
      };
    })
    .filter(Boolean);
}
