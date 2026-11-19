import { assertTopicScope } from "../../../../../lib/therapeuticAccess/scope";
import { NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../lib/pv/auth";
import { loadBotulinumPvCorpus } from "../../../../../lib/pv/botulinumCorpus";
import { importBundledBotulinumPvCorpus } from "../../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const principal = await requirePvPrincipal();
    assertTopicScope(principal.topicScope, "Botulinum toxin");
    const corpus = loadBotulinumPvCorpus();
    return NextResponse.json({ ok: true, corpus: { id: corpus.corpusId, therapeuticArea: corpus.therapeuticArea, fileName: corpus.fileName, rowCount: corpus.rowCount, screenableCount: corpus.rows.length, candidateCount: corpus.candidates.length, parseFailureCount: corpus.errors.length, dateColumn: corpus.dateColumn, contentColumns: corpus.contentColumns, sourceUrlColumn: corpus.sourceUrlColumn, externalIdColumn: corpus.externalIdColumn } });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}

export async function POST() {
  try {
    const principal = await requirePvPrincipal();
    assertTopicScope(principal.topicScope, "Botulinum toxin");
    return NextResponse.json({ ok: true, import: await importBundledBotulinumPvCorpus(principal) }, { status: 201 });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
