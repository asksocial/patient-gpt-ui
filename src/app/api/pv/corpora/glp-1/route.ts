import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../lib/pv/auth";
import { getCurrentEntitlements } from "../../../../../lib/entitlements/server";
import { hasTherapeuticAreaAccess } from "../../../../../lib/therapeuticAccess/server";
import { loadGlp1PvCorpus } from "../../../../../lib/pv/glp1/corpus";
import { getGlp1FaersReference } from "../../../../../lib/pv/glp1/reference";
import { setupGlp1PvLibrary, screenGlp1PvCorpus } from "../../../../../lib/pv/glp1/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorizedPrincipal() {
  const principal = await requirePvPrincipal();
  const entitlements = await getCurrentEntitlements();
  if (!entitlements || !await hasTherapeuticAreaAccess(entitlements.userId, "GLP-1", entitlements.isAdmin)) throw Object.assign(new Error("GLP-1 topic access required."), { status: 403 });
  return principal;
}

export async function GET() {
  try {
    await authorizedPrincipal();
    const corpus = loadGlp1PvCorpus();
    return NextResponse.json({ ok: true, reference: getGlp1FaersReference(), corpus: {
      id: corpus.corpusId, therapeuticArea: corpus.therapeuticArea, rowCount: corpus.rowCount,
      screenableCount: corpus.rows.length, candidateCount: corpus.candidates.length,
      candidateSegments: corpus.candidateSegments, audienceCounts: corpus.audienceCounts,
      audienceVersion: corpus.audienceVersion, corpusVersion: corpus.corpusVersion,
      heldCount: corpus.held.length, holdCounts: corpus.holdCounts,
      parseFailureCount: corpus.errors.length, sourceFileHash: corpus.sourceFileHash,
      sourceTimestampPolicy: corpus.sourceTimestampPolicy,
    } });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const principal = await authorizedPrincipal();
    const body = await request.json();
    if (body.action === "setup") return NextResponse.json({ ok: true, library: await setupGlp1PvLibrary(principal) });
    if (body.action === "screen") return NextResponse.json({ ok: true, import: await screenGlp1PvCorpus(principal) });
    throw new Error("Choose setup or screen. Library approval uses the governed approval workflow.");
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
