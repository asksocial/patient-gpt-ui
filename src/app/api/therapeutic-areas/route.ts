import { NextResponse } from "next/server";
import {
  getEffectiveTherapeuticAreaCoverage,
} from "../../../lib/answers/loadCanonicalFindingsForAsk";
import {
  getCurrentEntitlements,
} from "../../../lib/entitlements/server";
import {
  getActiveTherapeuticAreas,
  getUserTherapeuticAreas,
} from "../../../lib/therapeuticAccess/server";
import {
  sortTherapeuticAreas,
} from "../../../lib/therapeuticAreas";
import { getTherapeuticAreaCapabilityContract } from "../../../lib/therapeuticAreaCapabilities";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entitlements =
      await getCurrentEntitlements();

    if (!entitlements) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
          therapeuticAreas: [],
        },
        { status: 401 }
      );
    }

    const activeTherapeuticAreas =
      await getActiveTherapeuticAreas();
    const assignedTherapeuticAreas =
      entitlements.isAdmin
        ? activeTherapeuticAreas
        : await getUserTherapeuticAreas(
            entitlements.userId
          );
    const assignedSet = new Set(
      assignedTherapeuticAreas.map(
        (area) =>
          area.toLowerCase()
      )
    );
    const therapeuticAreas =
      sortTherapeuticAreas(
        activeTherapeuticAreas.filter(
          (area) =>
            assignedSet.has(
              area.toLowerCase()
            )
        )
      );
    const analyticalCoverage = therapeuticAreas.map((area) =>
      getEffectiveTherapeuticAreaCoverage(area)
    );

    return NextResponse.json({
      ok: true,
      therapeuticAreas,
      analyticalCoverage,
      capabilityContracts:
        therapeuticAreas.map((area, index) =>
          getTherapeuticAreaCapabilityContract(area, analyticalCoverage[index])
        ),
    });
  } catch (error) {
    console.error("[/api/therapeutic-areas] error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load therapeutic areas",
        therapeuticAreas: [],
      },
      { status: 500 }
    );
  }
}
