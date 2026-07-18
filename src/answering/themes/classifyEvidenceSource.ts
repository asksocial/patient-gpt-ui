import { CanonicalFinding } from "../models/finding";
import { EvidenceSourceCategory } from "./themeModels";

const FIRST_PERSON_PRONOUN_PATTERNS = [
  " i ",
  " i'm ",
  " i’m ",
  " i've ",
  " i’ve ",
  " my ",
  " me ",
  " myself ",
];

const FIRST_PERSON_EXPERIENCE_PATTERNS = [
  "i received",
  "i underwent",
  "i tried",
  "i chose",
  "i decided",
  "i stopped",
  "i started",
  "i experienced",
  "i noticed",
  "i felt",
  "my results",
  "my experience",
  "my treatment",
  "my symptoms",
  "my recovery",
  "my skin improved",
  "my condition improved",
  "worked for me",
  "did not work for me",
  "didn't work for me",
  "lasted for me",
  "side effects",
  "reaction",
  "swelling",
  "pain",
  "improvement",
  "worsened",
];

const TRANSACTIONAL_FIRST_PERSON_PATTERNS = [
  "i bought",
  "i got these products",
  "i purchased",
  "my haul",
  "shopping haul",
  "unboxing",
  "gifted to me",
  "gifted by",
  "products i got",
  "what i bought",
  "shop with me",
  "shopwithme",
  "sephora haul",
  "amazon haul",
];

const CAREGIVER_PATTERNS = [
  "as a caregiver",
  "caring for",
  "my child",
  "my son",
  "my daughter",
  "my husband",
  "my wife",
  "my mother",
  "my father",
  "my partner",
  "our family",
];

const PROVIDER_IDENTITY_PATTERNS = [
  "as a physician",
  "as a doctor",
  "as a clinician",
  "as a dermatologist",
  "as a surgeon",
  "as an injector",
  "as a nurse",
  "as a provider",
  "in my practice",
  "in our practice",
  "in my clinic",
  "in our clinic",
  "my clinical practice",
];

const PROVIDER_CLINICAL_PATTERNS = [
  "my patients",
  "our patients",
  "patient selection",
  "treatment planning",
  "clinical experience",
  "during consultation",
  "in consultation",
  "i recommend",
  "we recommend",
  "we assess",
  "i assess",
  "we treat",
  "i treat",
  "patient outcomes",
  "clinical outcomes",
  "contraindications",
  "treatment protocol",
  "clinical protocol",
];

const PRESS_RELEASE_PATTERNS = [
  "press release",
  "media contact",
  "pr newswire",
  "prnewswire",
  "business wire",
  "businesswire",
  "globe newswire",
  "announced today",
  "company announced",
  "announces the launch",
  "investor relations",
  "shareholder",
  "nasdaq",
  "forward-looking statements",
];

const CLINIC_MARKETING_PATTERNS = [
  "book now",
  "book your",
  "contact us",
  "call today",
  "call now",
  "phone:",
  "whatsapp",
  "free consultation",
  "schedule your",
  "make an appointment",
  "appointment today",
  "special offer",
  "limited offer",
  "price list",
  "dm us",
  "visit our clinic",
  "visit us",
  "clinic located",
  "consultation today",
];

const RETAIL_PATTERNS = [
  "shop now",
  "add to cart",
  "buy now",
  "available at",
  "available now",
  "promo code",
  "discount code",
  "affiliate link",
  "affiliate",
  "link in bio",
  "product page",
  "free shipping",
  "sale price",
  "shopping haul",
  "shopwithme",
  "sephora haul",
  "amazon haul",
  "unboxing",
];

const EVENT_PATTERNS = [
  "conference",
  "congress",
  "summit",
  "symposium",
  "webinar",
  "workshop",
  "masterclass",
  "register now",
  "event brings together",
  "join us at",
  "annual meeting",
  "exhibition",
];

const RESEARCH_PATTERNS = [
  "peer-reviewed",
  "peer reviewed",
  "clinical study",
  "clinical trial",
  "research study",
  "scientific evidence",
  "published in",
  "journal article",
  "systematic review",
  "randomized",
  "researchers found",
  "study found",
  "clinical evidence",
  "meta-analysis",
];

const EDITORIAL_PATTERNS = [
  "according to",
  "experts say",
  "reported that",
  "analysis",
  "editorial",
  "interview",
  "news report",
  "independent review",
  "industry analysis",
  "market analysis",
];

const BRAND_PATTERNS = [
  "our product",
  "our brand",
  "we are proud",
  "we're proud",
  "our solution",
  "our technology",
  "our treatment",
  "our portfolio",
  "we launched",
  "introducing our",
];

function normalizeText(
  value: unknown
): string {
  return ` ${String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()} `;
}

function includesAny(
  text: string,
  patterns: string[]
): boolean {
  return patterns.some((pattern) =>
    text.includes(pattern)
  );
}

function getFindingText(
  finding: CanonicalFinding,
  quote: string
): string {
  const f = finding as any;

  return normalizeText(
    [
      quote,
      f.canonicalClaim,
      f.summary,
      f.title,
      f.description,
      f.text,
      f.excerpt,
      f.platform,
      f.sourceType,
      f.url,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function isProviderVoice(
  text: string
): boolean {
  return (
    includesAny(
      text,
      PROVIDER_IDENTITY_PATTERNS
    ) &&
    includesAny(
      text,
      PROVIDER_CLINICAL_PATTERNS
    )
  );
}

function isFirstPersonExperience(
  text: string
): boolean {
  if (
    includesAny(
      text,
      TRANSACTIONAL_FIRST_PERSON_PATTERNS
    )
  ) {
    return false;
  }

  return (
    includesAny(
      text,
      FIRST_PERSON_PRONOUN_PATTERNS
    ) &&
    includesAny(
      text,
      FIRST_PERSON_EXPERIENCE_PATTERNS
    )
  );
}

export function classifyEvidenceSource(
  finding: CanonicalFinding,
  quote: string
): EvidenceSourceCategory {
  const text = getFindingText(
    finding,
    quote
  );

  /**
   * Order is intentional.
   * Promotional and transactional signals must be evaluated
   * before first-person language.
   */
  if (
    includesAny(
      text,
      PRESS_RELEASE_PATTERNS
    )
  ) {
    return "press_release";
  }

  if (
    includesAny(
      text,
      RETAIL_PATTERNS
    ) ||
    includesAny(
      text,
      TRANSACTIONAL_FIRST_PERSON_PATTERNS
    )
  ) {
    return "retail_or_product";
  }

  if (
    includesAny(
      text,
      CLINIC_MARKETING_PATTERNS
    )
  ) {
    return "clinic_marketing";
  }

  if (
    includesAny(
      text,
      EVENT_PATTERNS
    )
  ) {
    return "event_or_conference";
  }

  if (
    includesAny(
      text,
      CAREGIVER_PATTERNS
    )
  ) {
    return "caregiver_voice";
  }

  if (isProviderVoice(text)) {
    return "provider_voice";
  }

  if (
    isFirstPersonExperience(text)
  ) {
    return "first_person";
  }

  if (
    includesAny(
      text,
      RESEARCH_PATTERNS
    )
  ) {
    return "research_or_science";
  }

  if (
    includesAny(
      text,
      BRAND_PATTERNS
    )
  ) {
    return "brand_owned";
  }

  if (
    includesAny(
      text,
      EDITORIAL_PATTERNS
    ) ||
    normalizeText(
      (finding as any).platform
    ).includes("online news")
  ) {
    return "independent_editorial";
  }

  return "unknown";
}