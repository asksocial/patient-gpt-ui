import { NextRequest, NextResponse } from "next/server";
import { loadHybridData } from "../../../lib/answers/loadHybridData";
import { composeHybridAnswer } from "../../../lib/answers/composeHybridAnswer";
import { enrichHybridAnswerWithAnalytical } from "../../../lib/answers/enrichHybridAnswerWithAnalytical";
import { getRelevantCuratedInsights } from "../../../lib/curated/getRelevantCuratedInsights";
import { loadCanonicalFindingsForAsk } from "../../../lib/answers/loadCanonicalFindingsForAsk";
import { askSocial } from "../ask";
import {
  getKnowledgePersistenceStatus,
} from "../../../lib/knowledge/mode";
import {
  getTherapeuticAreaCoverage,
} from "../../../lib/analytics/coverage";
import {
  getCurrentEntitlements,
} from "../../../lib/entitlements/server";
import {
  hasTherapeuticAreaAccess,
} from "../../../lib/therapeuticAccess/server";
import {
  configurationFromEntitlements,
  isAiAgentId,
  isIntelligenceModuleId,
  resolveCustomerIntelligenceAccess,
} from "../../../lib/intelligence-platform";
import { buildCitationManifest } from "../../../lib/intelligence-platform/citations";

export const dynamic = "force-dynamic";

function normalizeCuratedThemes(items: any[] = []) {
  return items.map((item) => ({
    name: item?.name ?? item?.theme_name ?? "Unnamed theme",
    description:
      item?.description ??
      item?.theme_description ??
      item?.report_excerpt ??
      "",
  }));
}

function normalizeLiveThemes(items: any[] = []) {
  return items.map((item) => ({
    name: item?.name ?? item?.theme_name ?? "Unnamed live theme",
    description:
      item?.description ??
      item?.theme_description ??
      item?.summary ??
      "",
    sourceType: item?.sourceType ?? item?.source_type ?? undefined,
    relationship: item?.relationship ?? undefined,
  }));
}

function compactAnalyticalAnswer(
  intelligence:
    ReturnType<typeof askSocial> | null
) {
  if (!intelligence) {
    return null;
  }

  const answer =
    intelligence.answer;

  return {
    directAnswer:
      answer.directAnswer,
    sections: answer.sections.map(
      (section) => ({
        key: section.key,
        title: section.title,
        bullets:
          section.bullets,
        text: section.text,
      })
    ),
    usedFindingIds:
      answer.usedFindingIds,
    usedClaims:
      answer.usedClaims,
    liveDataStatus:
      answer.liveDataStatus,
  };
}

export async function POST(req: NextRequest) {
  try {
    const entitlements =
      await getCurrentEntitlements();

    if (!entitlements) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (
      !entitlements.capabilities
        .platform_core.granted
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "ENTITLEMENT_REQUIRED",
          error:
            "Enterprise Platform access is required.",
          requiredEntitlement:
            "platform_core",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const question = body?.question?.trim();
    const therapeuticArea = body?.therapeuticArea?.trim();
    const moduleId =
      body?.moduleId?.trim();
    const intelligenceMode =
      body?.intelligenceMode?.trim() ||
      "general";

    if (!question) {
      return NextResponse.json(
        { ok: false, error: "question is required" },
        { status: 400 }
      );
    }

    if (!therapeuticArea) {
      return NextResponse.json(
        { ok: false, error: "therapeuticArea is required" },
        { status: 400 }
      );
    }

    const customerAccess =
      resolveCustomerIntelligenceAccess(
        configurationFromEntitlements(
          entitlements
        )
      );
    const selectedModule =
      moduleId &&
      isIntelligenceModuleId(
        moduleId
      )
        ? customerAccess.modules.find(
            (item) =>
              item.id === moduleId
          )
        : undefined;

    if (
      moduleId &&
      !selectedModule
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "MODULE_ACCESS_REQUIRED",
          error:
            "The selected intelligence module is not licensed or permitted.",
          moduleId,
        },
        { status: 403 }
      );
    }

    const selectedAgent =
      intelligenceMode !==
        "general" &&
      isAiAgentId(
        intelligenceMode
      )
        ? customerAccess.agents.find(
            (agent) =>
              agent.id ===
                intelligenceMode &&
              (!selectedModule ||
                agent.moduleIds.includes(
                  selectedModule.id
                ))
          )
        : undefined;

    if (
      intelligenceMode !==
        "general" &&
      !selectedAgent
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "INTELLIGENCE_MODE_ACCESS_REQUIRED",
          error:
            "The selected Intelligence Mode is not licensed or permitted in this module.",
          intelligenceMode,
        },
        { status: 403 }
      );
    }

    const therapeuticAreaGranted =
      await hasTherapeuticAreaAccess(
        entitlements.userId,
        therapeuticArea,
        entitlements.isAdmin
      );

    if (!therapeuticAreaGranted) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "THERAPEUTIC_AREA_REQUIRED",
          error:
            `Access to ${therapeuticArea} has not been assigned.`,
          therapeuticArea,
        },
        { status: 403 }
      );
    }

    const [
      hybridData,
      curatedInsights,
    ] = await Promise.all([
      loadHybridData(
        therapeuticArea
      ),
      getRelevantCuratedInsights({
        therapeuticArea,
        question,
      }),
    ]);

    const curatedThemes = normalizeCuratedThemes(hybridData?.curatedThemes || []);
    const liveThemes = normalizeLiveThemes(hybridData?.liveThemes || []);
    const matches = hybridData?.matches || [];

    const canonicalData =
      loadCanonicalFindingsForAsk(
        therapeuticArea
      );
    const analyticalCoverage =
      getTherapeuticAreaCoverage(
        therapeuticArea
      );

    const themeIntelligenceGranted =
      entitlements.capabilities
        .theme_intelligence.granted;
    const longitudinalGranted =
      entitlements.capabilities
        .longitudinal_intelligence
        .granted;
    const executiveGranted =
      entitlements.capabilities
        .executive_intelligence
        .granted;
    const knowledgeGranted =
      entitlements.capabilities
        .knowledge_intelligence
        .granted;

    const intelligence =
      themeIntelligenceGranted &&
      canonicalData.status ===
        "available"
        ? askSocial(
            question,
            canonicalData.findings
          )
        : null;

    const hybridAnswer = await composeHybridAnswer({
      question,
      therapeuticArea,
      curatedThemes,
      liveThemes,
      matches,
      curatedInsights,
      gatewayContext: {
        requestId:
          req.headers.get(
            "x-request-id"
          ) ||
          crypto.randomUUID(),
        organizationId:
          entitlements.organizationId ||
          "unassigned",
        userId:
          entitlements.userId,
        moduleIds:
          selectedModule
            ? [
                selectedModule.id,
              ]
            : customerAccess.modules.map(
                (item) => item.id
              ),
        permissionTags:
          entitlements.granted,
      },
    });
    const answer = enrichHybridAnswerWithAnalytical(
      hybridAnswer,
      intelligence
    );
    const citationManifest = buildCitationManifest(
      intelligence?.themeSummary || [],
      curatedInsights
    );

    return NextResponse.json({
      ok: true,
      answer,
      citationManifest,
      relevantCuratedInsights: curatedInsights,
      analyticalStatus:
        !themeIntelligenceGranted
          ? "forbidden"
          : canonicalData.status,
      analyticalCoverage,
      knowledgePersistence:
        getKnowledgePersistenceStatus(),
      analyticalSource:
        canonicalData.status ===
        "available"
          ? {
              therapeuticAreaId:
                canonicalData.therapeuticAreaId,
              source:
                canonicalData.source,
              sourceLabel:
                canonicalData.sourceLabel,
              findingCount:
                canonicalData.findings.length,
            }
          : {
              therapeuticAreaId:
                canonicalData.therapeuticAreaId,
              reason:
                canonicalData.reason,
              findingCount: 0,
            },
      intent:
        intelligence?.intent || null,
      themeSummary:
        intelligence?.themeSummary || [],
      themeRelationships:
        intelligence?.themeRelationships ||
        [],
      themeStrategicImplications:
        intelligence?.themeStrategicImplications ||
        [],
      themeLongitudinalTracking:
        longitudinalGranted
          ? intelligence?.themeLongitudinalTracking ||
            null
          : null,
      knowledgeSnapshot:
        knowledgeGranted
          ? intelligence?.knowledgeSnapshot ||
            null
          : null,
      executiveIntelligence:
        executiveGranted
          ? intelligence?.executiveIntelligence ||
            null
          : null,
      analyticalAnswer:
        compactAnalyticalAnswer(
          intelligence
        ),
      entitlements,
      debug: {
        curatedThemesCount: curatedThemes.length,
        liveThemesCount: liveThemes.length,
        matchesCount: matches.length,
        curatedInsightsCount: curatedInsights.length,
        intelligenceMode,
        moduleId:
          selectedModule?.id ||
          null,
        analyticalStatus:
          !themeIntelligenceGranted
            ? "forbidden"
            : canonicalData.status,
        canonicalFindingCount:
          canonicalData.findings.length,
        analyticalThemeCount:
          intelligence?.themeSummary.length ||
          0,
        executiveBriefId:
          executiveGranted
            ? intelligence?.executiveIntelligence
                .briefId || null
            : null,
      },
    });
  } catch (error: any) {
    console.error("[/api/ask] error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to generate AskSocial answer",
      },
      { status: 500 }
    );
  }
}
