import fs from "fs";
import { IngestionContext } from "../types";
import { DiseaseProfile } from "../profiles";

export type MeltwaterRow = Record<string, any>;

function normalizeText(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function extractByPatternMap(
  text: string,
  patternMap: Record<string, string[]>
): string[] {
  const detected: string[] = [];

  for (const [label, patterns] of Object.entries(patternMap)) {
    if (includesAny(text, patterns)) {
      detected.push(label);
    }
  }

  return Array.from(new Set(detected));
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

function isEducationalContent(text: string, profile: DiseaseProfile): boolean {
  const builtInPatterns = [
    "did you know",
    "join us",
    "learn more",
    "awareness month",
    "raise awareness",
  ];

  return (
    includesAny(text, builtInPatterns) ||
    includesAny(text, profile.educationalExclusionPatterns || [])
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

function chooseSummary(row: MeltwaterRow): string {
  const hit = normalizeText(row["Hit Sentence"] || "");
  const open = normalizeText(row["Opening Text"] || "");
  const title = normalizeText(row["Title"] || "");

  if (hit) return hit;
  if (open) return open.slice(0, 220);
  return title;
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

  return rows
    .map((row) => {
      const title = normalizeText(row["Title"] || "");
      const opening = normalizeText(row["Opening Text"] || "");
      const hit = normalizeText(row["Hit Sentence"] || "");
      const tags = normalizeText(row["Document Tags"] || "");

      const combinedText = `${title} ${opening} ${hit}`.toLowerCase();

      if (!combinedText || combinedText.length < 20) return null;

      // 🚨 HARD BLOCK: vaccine / misinformation
      if (
        combinedText.includes("vaccine") ||
        combinedText.includes("shot") ||
        combinedText.includes("jab") ||
        combinedText.includes("vitamin k")
      ) {
        return null;
      }

      if (isHardExcluded(combinedText, profile)) return null;
      if (isLowQualityNoise(combinedText, profile)) return null;
      if (isExtraExcluded(combinedText, profile)) return null;

      // -------------------------
      // SYMPTOM EXTRACTION (NEW LOGIC)
      // -------------------------
      const rawSymptoms = extractByPatternMap(
        combinedText,
        profile.symptomPatterns || {}
      );

      const burden = hasBurdenLanguage(combinedText, profile);
      const patientVoice = hasPatientVoice(combinedText, profile);
      const caregiverVoice = hasCaregiverVoice(combinedText, profile);

      const symptoms = rawSymptoms.filter((symptom) => {
        // must be tied to lived experience
        if (!patientVoice && !burden) return false;

        // prevent false-positive jaundice inflation
        if (symptom === "jaundice" && !patientVoice && !burden) {
          return false;
        }

        return true;
      });

      const treatments = extractByPatternMap(
        combinedText,
        profile.treatmentPatterns || {}
      );

      // Balanced filtering
      if (
        isEducationalContent(combinedText, profile) &&
        symptoms.length === 0 &&
        !burden &&
        !patientVoice &&
        !caregiverVoice
      ) {
        return null;
      }

      if (
        isStatHeavy(combinedText) &&
        symptoms.length === 0 &&
        !patientVoice
      ) {
        return null;
      }

      if (
        profile.requireDiseaseContextForSymptoms &&
        !hasDiseaseContext(combinedText, profile)
      ) {
        return null;
      }

      // must have signal
      if (symptoms.length === 0 && !burden) return null;

      // must be tied to human context
      if (symptoms.length > 0 && !patientVoice && !caregiverVoice) {
        return null;
      }

      const persona = detectPersona(combinedText, tags, profile);

      // caregiver guardrail
      if (persona === "caregiver" && symptoms.length === 0) {
        return null;
      }

      const summary = chooseSummary(row);
      if (!summary) return null;

      return {
        id: row["Document ID"] || Math.random().toString(36).slice(2),
        findingType: "symptom_burden",
        title,
        summary,
        description: summary,
        text: opening,
        excerpt: hit,
        labels: ["symptom"],
        symptoms,
        treatments,
        country: normalizeText(row["Country"] || ""),
        platform: normalizeText(row["Source Type"] || ""),
        persona,
        url: normalizeText(row["URL"] || ""),
        sourceType: "live",
        sourceId: row["Document ID"],
        therapeuticArea: profile.therapeuticArea,
        score: Number(row["Engagement"] || 0),
        confidence: symptoms.length > 0 ? 0.85 : 0.7,
      };
    })
    .filter(Boolean);
}