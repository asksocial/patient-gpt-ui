import { createHash } from "node:crypto";

export type PvCsvColumnMapping = {
  dateColumn?: string;
  contentColumns?: string[];
  sourceUrlColumn?: string;
  externalIdColumn?: string;
};

export type PvCsvImportRow = {
  rowNumber: number;
  externalId: string;
  verbatim: string;
  sourceUrl: string;
  postedAt: string;
  postedAtRawValue: string;
};

export type PvCsvImportError = {
  rowNumber: number;
  error: string;
};

const DATE_COLUMNS = ["date", "post date", "posted date", "published date", "publication date", "timestamp", "posted_at", "published_at"];
const CONTENT_COLUMNS = ["hit sentence", "opening text", "title", "text", "content", "body", "message", "post"];
const URL_COLUMNS = ["url", "source url", "post url", "link", "document url"];
const ID_COLUMNS = ["external id", "document id", "post id", "id"];

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function decodeCsv(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.slice(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.slice(2));
  const sample = bytes.slice(0, Math.min(bytes.length, 200));
  const nullOddBytes = sample.filter((value, index) => index % 2 === 1 && value === 0).length;
  if (nullOddBytes > sample.length / 8) return new TextDecoder("utf-16le").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

function delimiterFor(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(field); field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function resolveHeader(headers: string[], requested: string | undefined, candidates: string[], required: boolean) {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  if (requested?.trim()) {
    const exact = normalized.get(normalizeHeader(requested));
    if (!exact) throw new Error(`CSV column “${requested}” was not found.`);
    return exact;
  }
  const detected = candidates.map((candidate) => normalized.get(candidate)).find(Boolean);
  if (!detected && required) throw new Error(`CSV is missing a supported ${candidates[0]} column. Provide the column name explicitly.`);
  return detected;
}

export function parseCsvPostDate(value: string) {
  const raw = value.trim();
  if (!raw) throw new Error("Post date is empty.");
  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    const milliseconds = Math.round((serial - 25569) * 86_400_000);
    const excelDate = new Date(milliseconds);
    if (!Number.isNaN(excelDate.getTime())) return excelDate.toISOString();
  }
  const unzonedIso = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/);
  const parsed = new Date(unzonedIso ? `${unzonedIso[1]}T${unzonedIso[2]}Z` : raw);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Post date “${raw}” is not a valid timestamp.`);
  return parsed.toISOString();
}

export function parsePvCsv(bytes: Uint8Array, fileName: string, mapping: PvCsvColumnMapping = {}) {
  const text = decodeCsv(bytes).replace(/^\uFEFF/, "");
  const parsed = parseDelimited(text, delimiterFor(text));
  if (parsed.length < 2) throw new Error("CSV must include a header and at least one data row.");
  const headers = parsed[0].map((header) => header.trim());
  const dateColumn = resolveHeader(headers, mapping.dateColumn, DATE_COLUMNS, true)!;
  const requestedContent = (mapping.contentColumns || []).filter(Boolean);
  const contentColumns = requestedContent.length
    ? requestedContent.map((column) => resolveHeader(headers, column, [], true)!)
    : CONTENT_COLUMNS.map((candidate) => resolveHeader(headers, undefined, [candidate], false)).filter(Boolean) as string[];
  if (!contentColumns.length) throw new Error("CSV is missing a supported social-content column. Provide one or more content column names.");
  const sourceUrlColumn = resolveHeader(headers, mapping.sourceUrlColumn, URL_COLUMNS, false);
  const externalIdColumn = resolveHeader(headers, mapping.externalIdColumn, ID_COLUMNS, false);
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const rows: PvCsvImportRow[] = [];
  const errors: PvCsvImportError[] = [];
  parsed.slice(1).forEach((values, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const cell = (column?: string) => column ? String(values[indexes.get(column)!] || "").trim() : "";
    try {
      const postedAtRawValue = cell(dateColumn);
      const verbatim = Array.from(new Set(contentColumns.map((column) => cell(column)).filter(Boolean))).join(" ");
      if (!verbatim) throw new Error("Social content is empty.");
      const externalId = cell(externalIdColumn) || createHash("sha256").update(`${fileHash}:${rowNumber}`).digest("hex");
      const sourceUrl = cell(sourceUrlColumn) || `urn:asksocial:pv-import:${fileHash}:${rowNumber}`;
      rows.push({ rowNumber, externalId, verbatim, sourceUrl, postedAt: parseCsvPostDate(postedAtRawValue), postedAtRawValue });
    } catch (error) {
      errors.push({ rowNumber, error: error instanceof Error ? error.message : "CSV row could not be parsed." });
    }
  });
  if (!rows.length) throw new Error(`CSV has no screenable rows. ${errors[0]?.error || "Check the selected columns."}`);
  return { fileName, fileHash, headers, dateColumn, contentColumns, sourceUrlColumn, externalIdColumn, rowCount: parsed.length - 1, rows, errors };
}
