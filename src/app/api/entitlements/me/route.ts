import {
  NextResponse,
} from "next/server";
import {
  ENTITLEMENT_CATALOG,
} from "../../../../lib/entitlements";
import {
  getCurrentEntitlements,
} from "../../../../lib/entitlements/server";

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

    return NextResponse.json({
      ok: true,
      entitlements,
      catalog:
        ENTITLEMENT_CATALOG,
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
