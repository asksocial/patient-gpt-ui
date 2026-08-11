import { NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../lib/pv/auth";
import { loadBotulinumPvCorpus } from "../../../../../lib/pv/botulinumCorpus";
import { importBundledBotulinumPvCorpus } from "../../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    await requirePvPrincipal();
    const corpus = loadBotulinumPvCorpus();
    return NextResponse.json({ ok: true, corpus: { id: corpus.corpusId, therapeuticArea: corpus.therapeuticArea, fileName: corpus.fileName, rowCount: corpus.rowCount, screenableCount: corpus.rows.length, candidateCount: corpus.candidates.length, parseFailureCount: corpus.errors.length, dateColumn: corpus.dateColumn, contentColumns: corpus.contentColumns, sourceUrlColumn: corpus.sourceUrlColumn, externalIdColumn: corpus.externalIdColumn } });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}

export async function POST() {
  try {
    return NextResponse.json({ ok: true, import: await importBundledBotulinumPvCorpus(await requirePvPrincipal()) }, { status: 201 });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
