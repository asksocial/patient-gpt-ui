import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { parsePvCsv } from "../../../../lib/pv/csvImport";
import { importPvCsvBatch, listPvImportBatches } from "../../../../lib/pv/service";

export const dynamic = "force-dynamic";

const MAX_CSV_BYTES = 4 * 1024 * 1024;

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ ok: true, imports: await listPvImportBatches(await requirePvPrincipal(), 50, request.nextUrl.searchParams.get("therapeuticArea") || undefined) });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const principal = await requirePvPrincipal();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose a CSV file to screen.");
    if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("PV imports must be CSV files.");
    if (!file.size || file.size > MAX_CSV_BYTES) throw new Error("CSV files must be between 1 byte and 4 MB.");

    const contentColumns = String(form.get("contentColumns") || "")
      .split(",").map((value) => value.trim()).filter(Boolean);
    const parsed = parsePvCsv(new Uint8Array(await file.arrayBuffer()), file.name, {
      dateColumn: String(form.get("dateColumn") || "").trim() || undefined,
      contentColumns: contentColumns.length ? contentColumns : undefined,
      sourceUrlColumn: String(form.get("sourceUrlColumn") || "").trim() || undefined,
      externalIdColumn: String(form.get("externalIdColumn") || "").trim() || undefined,
      authorIdentifierColumn: String(form.get("authorIdentifierColumn") || "").trim() || undefined,
    });
    const imported = await importPvCsvBatch(principal, {
      libraryId: String(form.get("libraryId") || ""),
      sourceId: String(form.get("sourceId") || "").trim() || undefined,
      fileName: parsed.fileName,
      fileHash: parsed.fileHash,
      dataOrigin: form.get("dataOrigin") === "live" ? "live" : "curated",
      dateColumn: parsed.dateColumn,
      contentColumns: parsed.contentColumns,
      sourceUrlColumn: parsed.sourceUrlColumn,
      externalIdColumn: parsed.externalIdColumn,
      authorIdentifierColumn: parsed.authorIdentifierColumn,
      rowCount: parsed.rowCount,
      rows: parsed.rows,
      parseErrors: parsed.errors,
    });
    return NextResponse.json({ ok: true, import: imported }, { status: 201 });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
