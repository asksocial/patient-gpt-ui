import {
  auth,
} from "@clerk/nextjs/server";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  isThemeKnowledgeSnapshot,
  listThemeKnowledgeSnapshots,
  saveThemeKnowledgeSnapshot,
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

async function getPrincipal(): Promise<{
  principal: KnowledgePrincipal;
  userId: string;
} | null> {
  const { userId, orgId } =
    await auth();

  if (!userId) {
    return null;
  }

  return {
    userId,
    principal: {
      principalId: orgId || userId,
      principalType: orgId
        ? "organization"
        : "user",
    },
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const resolved =
      await getPrincipal();

    if (!resolved) {
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

    const therapeuticArea =
      request.nextUrl.searchParams
        .get("therapeuticArea")
        ?.trim();

    if (!therapeuticArea) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "therapeuticArea is required",
        },
        { status: 400 }
      );
    }

    const limit = Number(
      request.nextUrl.searchParams.get(
        "limit"
      ) || 20
    );
    const snapshots =
      await listThemeKnowledgeSnapshots(
        resolved.principal,
        therapeuticArea,
        Number.isFinite(limit)
          ? limit
          : 20
      );

    return NextResponse.json({
      ok: true,
      snapshots,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load knowledge snapshots";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const resolved =
      await getPrincipal();

    if (!resolved) {
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

    const body = await request.json();
    const snapshot = body?.snapshot;

    if (
      !isThemeKnowledgeSnapshot(
        snapshot
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid theme knowledge snapshot is required",
        },
        { status: 400 }
      );
    }

    const stored =
      await saveThemeKnowledgeSnapshot(
        resolved.principal,
        snapshot,
        resolved.userId
      );

    return NextResponse.json({
      ok: true,
      stored,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save knowledge snapshot";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
