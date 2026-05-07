import fs from "fs";
import path from "path";

export type CuratedFindingRecord = {
  id: string;
  findingType:
    | "symptom_burden"
    | "treatment_decision"
    | "safety_signal"
    | "theme"
    | "persona"
    | "unmet_need"
    | "channel_insight"
    | "market_insight"
    | "lexicon"
    | "recommendation"
    | "evidence_quote"
    | "burden";

  title: string;
  summary: string;

  therapeuticArea: string;
  diseaseArea?: string;
  profileId?: string;

  theme?: string;
  subtheme?: string;

  persona?: string;
  personaTraits?: string[];
  lifecycleStage?: string;

  symptoms?: string[];
  treatments?: string[];
  barriers?: string[];
  emotions?: string[];
  unmetNeeds?: string[];

  channels?: string[];
  markets?: string[];
  countries?: string[];

  labels?: string[];
  lexiconExamples?: string[];
  evidenceQuotes?: string[];

  rationale?: string;
  action?: string;
  whyItMatters?: string;
  linkedThemes?: string[];

  sourceType?: "curated";
  sourceFormat?: "pptx" | "pdf" | "docx" | "manual";
  sourceDocument?: string;
  sourceSlideOrPage?: string;

  country?: string;
  platform?: string;
  url?: string;
  confidence?: number;
};

function normalizeStringArray(values?: string[]): string[] {
  return Array.from(
    new Set((values || []).map((v) => (v || "").trim()).filter(Boolean))
  );
}

function normalizeCuratedRecord(
  record: CuratedFindingRecord
): CuratedFindingRecord {
  return {
    ...record,
    labels: normalizeStringArray(record.labels),
    symptoms: normalizeStringArray(record.symptoms),
    treatments: normalizeStringArray(record.treatments),
    barriers: normalizeStringArray(record.barriers),
    emotions: normalizeStringArray(record.emotions),
    unmetNeeds: normalizeStringArray(record.unmetNeeds),
    channels: normalizeStringArray(record.channels),
    markets: normalizeStringArray(record.markets),
    countries: normalizeStringArray(record.countries),
    personaTraits: normalizeStringArray(record.personaTraits),
    lexiconExamples: normalizeStringArray(record.lexiconExamples),
    evidenceQuotes: normalizeStringArray(record.evidenceQuotes),
    linkedThemes: normalizeStringArray(record.linkedThemes),
    sourceType: "curated",
    persona: record.persona || "unknown",
    country: record.country || "",
    platform: record.platform || "curated",
    url: record.url || "",
    confidence: record.confidence ?? 0.9,
  };
}

function getCuratedFilePath(profileId: string): string {
  return path.resolve(__dirname, `${profileId}.json`);
}

export function ingestCurated(profileId: string): CuratedFindingRecord[] {
  const filePath = getCuratedFilePath(profileId);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Curated file for profile "${profileId}" must contain a top-level array.`
    );
  }

  return parsed.map((record) =>
    normalizeCuratedRecord(record as CuratedFindingRecord)
  );
}