import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import { hasTherapeuticAreaAccess } from "../../../../lib/therapeuticAccess/server";
import { loadCanonicalFindingsForAsk } from "../../../../lib/answers/loadCanonicalFindingsForAsk";
import { getAudienceCorpusRevision, loadAudienceConversationPosts } from "../../../../lib/answers/loadSearchCorpusIntelligence";
import { CLIENT_AUDIENCE_GROUPS } from "../../../../answering/personas/clientAudienceGroups";
import { AUDIENCE_ROLES, CONVERSATION_SEGMENTS } from "../../../../ingestion/audienceSegments";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const access = await getCurrentEntitlements();
    if (!access) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers });
    if (!access.capabilities.platform_core?.granted && !access.isAdmin) return NextResponse.json({ ok: false, error: "Platform access is required." }, { status: 403, headers });
    const params = request.nextUrl.searchParams;
    const therapeuticArea = params.get("therapeuticArea") || "";
    const group = params.get("group") || "";
    const conversationType = params.get("conversationType") || "";
    const role = params.get("role") || "";
    const question = params.get("question") || "";
    if (!therapeuticArea || !CLIENT_AUDIENCE_GROUPS.some(item => item.id === group)
      || !Object.hasOwn(CONVERSATION_SEGMENTS, conversationType) || (role && !Object.hasOwn(AUDIENCE_ROLES, role)) || question.length > 10000) {
      return NextResponse.json({ ok: false, error: "A supported topic, audience group and conversation type are required." }, { status: 400, headers });
    }
    if (!await hasTherapeuticAreaAccess(access.userId, therapeuticArea, access.isAdmin)) return NextResponse.json({ ok: false, error: "Topic access is required." }, { status: 403, headers });
    if (params.get("corpusRevision") !== getAudienceCorpusRevision(therapeuticArea)) return NextResponse.json({ ok: false, error: "The corpus changed. Refresh the analysis before opening its posts." }, { status: 409, headers });
    const corpus = loadCanonicalFindingsForAsk(therapeuticArea);
    if (corpus.status !== "available") return NextResponse.json({ ok: false, error: corpus.reason }, { status: 422, headers });
    const evidence = loadAudienceConversationPosts(therapeuticArea, corpus.findings, { question, group, conversationType, role, page: Number(params.get("page") || 1) });
    return NextResponse.json({ ok: true, evidence }, { headers });
  } catch {
    return NextResponse.json({ ok: false, error: "Conversation posts could not be loaded." }, { status: 500, headers });
  }
}
