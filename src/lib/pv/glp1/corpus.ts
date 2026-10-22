import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseMeltwaterCsv } from "../../../ingestion/adapters/meltwaterAdapter";
import { parseCsvPostDate, type PvCsvImportRow, type PvCsvImportError } from "../csvImport";
import { classifyGlp1PvContent } from "./detection";
import { GLP1_PV_VERSION } from "./config";

export type Glp1PvRow = PvCsvImportRow & { language: "en"; sourceType: string; market?: string };

export function loadGlp1PvCorpus() {
  const file = path.resolve(process.cwd(), "data/glp-1.csv");
  const bytes = fs.readFileSync(file);
  const sourceRows = parseMeltwaterCsv(file);
  // This Meltwater export has one complete TSV record per physical line.
  // Quotes inside verbatims are source text, not RFC CSV field delimiters.
  const lines = bytes.toString("utf16le").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const headers = lines[0].split("\t");
  if (lines.slice(1).some((line) => line.split("\t").length !== headers.length)) throw new Error("GLP-1 Meltwater TSV schema changed; review the export before screening.");
  const sourceFileHash = createHash("sha256").update(bytes).digest("hex");
  const errors: PvCsvImportError[] = [];
  const rows: Glp1PvRow[] = [];
  const held: Array<{ rowNumber: number; reason: string }> = [];
  for (const [index, source] of sourceRows.entries()) {
    const rowNumber = index + 2;
    if (String(source.Language || "").toLowerCase() !== "english") { held.push({ rowNumber, reason: "unsupported_or_unknown_language" }); continue; }
    if (!/^https?:\/\//i.test(source.URL || "")) { held.push({ rowNumber, reason: "missing_source_url" }); continue; }
    const sourceType = String(source["Source Type"] || "");
    if (!["social network", "forum", "comments", "reviews", "blog"].includes(sourceType.toLowerCase())) { held.push({ rowNumber, reason: "source_requires_separate_screening_scope" }); continue; }
    const timestamp = [source.Date, source.Time].filter(Boolean).join(" ");
    const authorIdentifier = String(source["Author Handle"] || source["Author Name"] || "").trim() || undefined;
    try {
      const externalId = `glp1:social:${String(source["Document ID"] || "").replace(/^"+|"+$/g, "")}`;
      const verbatim = [...new Set([source.Title, source["Opening Text"], source["Hit Sentence"]].filter((value) => value?.trim()))].join(" ");
      if (!verbatim || externalId === "glp1:social:") throw new Error("Missing verbatim or source identifier.");
      rows.push({ rowNumber, externalId, verbatim, sourceUrl: source.URL, authorIdentifier, postedAt: parseCsvPostDate(timestamp), postedAtRawValue: timestamp, sourceType, language: "en", market: String(source.Country || "") || undefined });
    } catch (error) { errors.push({ rowNumber, error: error.message }); }
  }
  const candidates = rows.filter((row) => classifyGlp1PvContent({ ...row, dataOrigin: "curated" }).shouldCreateRecord);
  return {
    fileName: "glp-1.csv", rowCount: sourceRows.length, errors, contentColumns: ["Title", "Opening Text", "Hit Sentence"],
    fileHash: createHash("sha256").update(`${sourceFileHash}:${GLP1_PV_VERSION}:social-en`).digest("hex"),
    sourceFileHash, corpusId: "glp_1_social_pv_2026_10_20", therapeuticArea: "GLP-1",
    rows, candidates, held, sourceTimestampPolicy: "Export date and time interpreted as UTC; source timezone not supplied.",
    holdCounts: held.reduce((counts, row) => ({ ...counts, [row.reason]: (counts[row.reason] || 0) + 1 }), {} as Record<string, number>),
  };
}
