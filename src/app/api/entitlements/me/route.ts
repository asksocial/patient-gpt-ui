import {
  NextResponse,
} from "next/server";
import {
  ENTITLEMENT_CATALOG,
} from "../../../../lib/entitlements";
import {
  getCurrentEntitlements,
} from "../../../../lib/entitlements/server";
import {
  configurationFromEntitlements,
  buildCommercialPackaging,
  resolveCustomerIntelligenceAccess,
} from "../../../../lib/intelligence-platform";

export const dynamic =
  "force-dynamic";

export async function GET() {
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

    const intelligenceAccess =
      resolveCustomerIntelligenceAccess(
        configurationFromEntitlements(
          entitlements
        )
      );
    const commercialPackaging =
      buildCommercialPackaging(
        entitlements
      );

    return NextResponse.json({
      ok: true,
      entitlements,
      intelligenceAccess: {
        modules:
          intelligenceAccess.modules,
        agents:
          intelligenceAccess.agents,
        workflows:
          intelligenceAccess.workflows,
      },
      catalog:
        ENTITLEMENT_CATALOG,
      commercialPackaging,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to resolve entitlements";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
