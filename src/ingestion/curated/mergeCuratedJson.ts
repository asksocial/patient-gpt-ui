import fs from "fs";
import path from "path";

type CuratedFindingRecord = {
  id: string;
  findingType: string;
  title: string;
  summary: string;
  labels?: string[];
  symptoms?: string[];
  treatments?: string[];
  therapeuticArea: string;
  persona?: string;
  sourceType?: "curated";
  country?: string;
  platform?: string;
  url?: string;
  confidence?: number;
};

function normalizeText(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizeArray(values?: string[]): string[] {
  return Array.from(
    new Set((values || []).map((v) => normalizeText(v)).filter(Boolean))
  );
}

function buildFingerprint(record: CuratedFindingRecord): string {
  const title = normalizeText(record.title).toLowerCase();
  const summary = normalizeText(record.summary).toLowerCase();
  const findingType = normalizeText(record.findingType).toLowerCase();
  const therapeuticArea = normalizeText(record.therapeuticArea).toLowerCase();
  const symptoms = normalizeArray(record.symptoms).sort().join("|");
  const treatments = normalizeArray(record.treatments).sort().join("|");

  return [
    findingType,
    therapeuticArea,
    title.slice(0, 120),
    summary.slice(0, 240),
    symptoms,
    treatments,
  ].join("::");
}

function mergeTwoRecords(
  a: CuratedFindingRecord,
  b: CuratedFindingRecord
): CuratedFindingRecord {
  return {
    ...a,
    title:
      normalizeText(a.title).length >= normalizeText(b.title).length
        ? a.title
        : b.title,
    summary:
      normalizeText(a.summary).length >= normalizeText(b.summary).length
        ? a.summary
        : b.summary,
    labels: normalizeArray([...(a.labels || []), ...(b.labels || [])]),
    symptoms: normalizeArray([...(a.symptoms || []), ...(b.symptoms || [])]),
    treatments: normalizeArray([
      ...(a.treatments || []),
      ...(b.treatments || []),
    ]),
    therapeuticArea: a.therapeuticArea || b.therapeuticArea,
    persona:
      a.persona && a.persona !== "unknown"
        ? a.persona
        : b.persona || "unknown",
    sourceType: "curated",
    country: a.country || b.country || "",
    platform: a.platform || b.platform || "curated_ppt",
    url: a.url || b.url || "",
    confidence: Math.max(a.confidence || 0.9, b.confidence || 0.9),
  };
}

function readCuratedFile(filePath: string): CuratedFindingRecord[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array in curated file: ${filePath}`);
  }

  return parsed as CuratedFindingRecord[];
}

function dedupeRecords(records: CuratedFindingRecord[]): CuratedFindingRecord[] {
  const byFingerprint = new Map<string, CuratedFindingRecord>();

  for (const record of records) {
    const fingerprint = buildFingerprint(record);

    if (!byFingerprint.has(fingerprint)) {
      byFingerprint.set(fingerprint, {
        ...record,
        labels: normalizeArray(record.labels),
        symptoms: normalizeArray(record.symptoms),
        treatments: normalizeArray(record.treatments),
        sourceType: "curated",
        persona: record.persona || "unknown",
        country: record.country || "",
        platform: record.platform || "curated_ppt",
        url: record.url || "",
        confidence: record.confidence ?? 0.9,
      });
      continue;
    }

    const existing = byFingerprint.get(fingerprint)!;
    byFingerprint.set(fingerprint, mergeTwoRecords(existing, record));
  }

  return Array.from(byFingerprint.values()).map((record, index) => ({
    ...record,
    id: record.id || `${record.therapeuticArea}_${index + 1}`,
  }));
}

function main() {
  const [, , outputPathArg, ...inputFiles] = process.argv;

  if (!outputPathArg || inputFiles.length === 0) {
    console.error(
      'Usage:\n' +
        'npx ts-node --compiler-options \'{"module":"CommonJS"}\' src/ingestion/curated/mergeCuratedJson.ts <outputPath> <input1.json> <input2.json> [input3.json ...]'
    );
    process.exit(1);
  }

  const outputPath = path.resolve(outputPathArg);
  const inputPaths = inputFiles.map((file) => path.resolve(file));

  const allRecords: CuratedFindingRecord[] = [];

  for (const inputPath of inputPaths) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const records = readCuratedFile(inputPath);
    allRecords.push(...records);
  }

  const deduped = dedupeRecords(allRecords);

  fs.writeFileSync(outputPath, JSON.stringify(deduped, null, 2), "utf8");

  console.log(`Read ${allRecords.length} total curated findings`);
  console.log(`Wrote ${deduped.length} deduped curated findings`);
  console.log(`Output: ${outputPath}`);
}

main();