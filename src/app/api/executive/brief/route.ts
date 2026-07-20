import {
  auth,
} from "@clerk/nextjs/server";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  buildExecutiveIntelligenceBrief,
} from "../../../../answering/executive";
import {
  compareThemeKnowledgeSnapshots,
} from "../../../../answering/knowledge";
import {
  isThemeKnowledgeSnapshot,
} from "../../../../lib/knowledge/themeKnowledgeStore";
import {
  getCurrentEntitlements,
} from "../../../../lib/entitlements/server";
import {
  hasTherapeuticAreaAccess,
} from "../../../../lib/therapeuticAccess/server";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: NextRequest
) {
  try {
    const { userId } =
      await auth();

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const entitlements =
      await getCurrentEntitlements();

    if (
      !entitlements?.capabilities
        .executive_intelligence
        .granted
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "ENTITLEMENT_REQUIRED",
          error:
            "Executive Intelligence access is required.",
          requiredEntitlement:
            "executive_intelligence",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const snapshot = body?.snapshot;
    const baselineSnapshot =
      body?.baselineSnapshot;

    if (
      !isThemeKnowledgeSnapshot(
        snapshot
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid current theme knowledge snapshot is required",
        },
        { status: 400 }
      );
    }

    const therapeuticAreaGranted =
      await hasTherapeuticAreaAccess(
        entitlements.userId,
        snapshot.therapeuticArea,
        entitlements.isAdmin
      );

    if (!therapeuticAreaGranted) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "THERAPEUTIC_AREA_REQUIRED",
          error:
            `Access to ${snapshot.therapeuticArea} has not been assigned.`,
          therapeuticArea:
            snapshot.therapeuticArea,
        },
        { status: 403 }
      );
    }

    if (
      baselineSnapshot !==
        undefined &&
      !isThemeKnowledgeSnapshot(
        baselineSnapshot
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "baselineSnapshot must be a valid theme knowledge snapshot when provided",
        },
        { status: 400 }
      );
    }

    const comparison =
      baselineSnapshot
        ? compareThemeKnowledgeSnapshots(
            baselineSnapshot,
            snapshot
          )
        : undefined;

    const brief =
      buildExecutiveIntelligenceBrief({
        snapshot,
        comparison,
      });

    return NextResponse.json({
      ok: true,
      brief,
      comparison:
        comparison || null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to build executive intelligence brief";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
