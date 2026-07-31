import {
  NextResponse,
} from "next/server";
import {
  AI_MODEL_ROUTES,
  AI_PROMPT_REGISTRY,
  AI_TOOL_REGISTRY,
} from "../../../../lib/ai-gateway";
import {
  configurationFromEntitlements,
  EVALUATION_CHANGE_TRIGGERS,
  METRIC_CATALOG,
  resolveCustomerIntelligenceAccess,
} from "../../../../lib/intelligence-platform";
import {
  getCurrentEntitlements,
} from "../../../../lib/entitlements/server";

export const dynamic =
  "force-dynamic";

export async function GET() {
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

  const access =
    resolveCustomerIntelligenceAccess(
      configurationFromEntitlements(
        entitlements
      )
    );

  return NextResponse.json({
    ok: true,
    governance: {
      approvedModels:
        AI_MODEL_ROUTES.map(
          (route) => ({
            routeId: route.id,
            primaryModelId:
              route.primaryModelId,
            fallbackModelIds:
              route.fallbackModelIds,
          })
        ),
      enabledAgents:
        access.agents.map(
          (agent) => ({
            id: agent.id,
            name: agent.name,
            allowedTools:
              agent.allowedTools,
          })
        ),
      enabledTools:
        AI_TOOL_REGISTRY.map(
          (tool) => ({
            id: tool.id,
            approvalRequired:
              tool.approvalRequired,
          })
        ),
      prompts:
        AI_PROMPT_REGISTRY.map(
          (prompt) => ({
            id: prompt.id,
            version:
              prompt.version,
          })
        ),
      controls: {
        tenantIsolation: true,
        modulePermissions: true,
        recordAndFieldPolicy:
          true,
        promptInjectionDefense:
          true,
        immutableAudit: true,
        humanApproval: true,
      },
      measurement: {
        metricCatalog:
          METRIC_CATALOG,
        evaluationTriggers:
          EVALUATION_CHANGE_TRIGGERS,
      },
    },
  });
}
