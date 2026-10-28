import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import { loadCanonicalFindingsForAsk } from "../../../../lib/answers/loadCanonicalFindingsForAsk";
import { selectSearchCorpusForQuestion } from "../../../../lib/answers/loadSearchCorpusIntelligence";
import { paginateThemeMentions } from "../../../../answering/search/themeMentionCatalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const entitlements = await getCurrentEntitlements();
  if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!entitlements.capabilities.platform_core.granted) return NextResponse.json({ ok: false, error: "Enterprise Platform access is required." }, { status: 403 });
  const params = request.nextUrl.searchParams;
  const therapeuticArea = params.get("therapeuticArea")?.trim() || "";
  const question = params.get("question")?.trim() || "";
  const topicId = params.get("topicId")?.trim() || "";
  if (!therapeuticArea || !question || !topicId || question.length > 10000) return NextResponse.json({ ok: false, error: "A topic, Search question and theme are required." }, { status: 400 });
  try {
    const corpus = loadCanonicalFindingsForAsk(therapeuticArea);
    if (corpus.status !== "available") return NextResponse.json({ ok: false, error: corpus.reason }, { status: 422 });
    const { summary } = selectSearchCorpusForQuestion(therapeuticArea, corpus.findings, question, { allExamples: true, topicId });
    const evidence = paginateThemeMentions(summary.questionEvidence, topicId, params.get("q") || "", Number(params.get("page") || 1));
    if (!evidence) return NextResponse.json({ ok: false, error: "This theme has no supporting mentions for the Search question." }, { status: 404 });
    return NextResponse.json({ ok: true, evidence });
  } catch {
    return NextResponse.json({ ok: false, error: "Theme mentions could not be loaded. Please try again." }, { status: 500 });
  }
}
