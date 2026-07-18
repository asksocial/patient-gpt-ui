import {
  auth,
} from "@clerk/nextjs/server";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  compareThemeKnowledgeSnapshots,
} from "../../../../answering/knowledge";
import {
  getThemeKnowledgeSnapshot,
  type KnowledgePrincipal,
} from "../../../../lib/knowledge/themeKnowledgeStore";
import {
  getKnowledgePersistenceMode,
  knowledgePersistenceDisabledResponse,
} from "../../../../lib/knowledge/mode";
import {
  getCurrentEntitlements,
} from "../../../../lib/entitlements/server";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: NextRequest
) {
  try {
    const { userId, orgId } =
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

    if (
      getKnowledgePersistenceMode() !==
      "persistent"
    ) {
      return NextResponse.json(
        knowledgePersistenceDisabledResponse(),
        { status: 503 }
      );
    }

    const entitlements =
      await getCurrentEntitlements();

    if (
      !entitlements?.capabilities
        .knowledge_intelligence
        .granted
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "ENTITLEMENT_REQUIRED",
          error:
            "Knowledge Intelligence access is required.",
          requiredEntitlement:
            "knowledge_intelligence",
        },
        { status: 403 }
      );
    }

    const principal:
      KnowledgePrincipal = {
      principalId: orgId || userId,
      principalType: orgId
        ? "organization"
        : "user",
    };
    const body = await request.json();
    const baselineSnapshotId =
      String(
        body?.baselineSnapshotId ||
          ""
      ).trim();
    const currentSnapshotId =
      String(
        body?.currentSnapshotId ||
          ""
      ).trim();

    if (
      !baselineSnapshotId ||
      !currentSnapshotId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "baselineSnapshotId and currentSnapshotId are required",
        },
        { status: 400 }
      );
    }

    const [baseline, current] =
      await Promise.all([
        getThemeKnowledgeSnapshot(
          principal,
          baselineSnapshotId
        ),
        getThemeKnowledgeSnapshot(
          principal,
          currentSnapshotId
        ),
      ]);

    if (!baseline || !current) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "One or both knowledge snapshots were not found",
        },
        { status: 404 }
      );
    }

    const comparison =
      compareThemeKnowledgeSnapshots(
        baseline.snapshot,
        current.snapshot
      );

    return NextResponse.json({
      ok: true,
      comparison,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to compare knowledge snapshots";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
