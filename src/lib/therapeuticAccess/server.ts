import {
  getSupabaseServerClient,
} from "../supabase/server";

function compactText(
  value: unknown
): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTherapeuticAreaAssignments(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    throw new Error(
      "therapeuticAreas must be an array"
    );
  }

  return Array.from(
    new Set(
      value
        .map(compactText)
        .filter(Boolean)
    )
  );
}

export async function getActiveTherapeuticAreas(): Promise<
  string[]
> {
  const supabase =
    getSupabaseServerClient();
  const { data, error } =
    await supabase
      .from("therapeutic_areas")
      .select("name")
      .eq("is_active", true)
      .order("sort_order", {
        ascending: true,
      });

  if (error) {
    throw new Error(
      `Failed to load therapeutic areas: ${error.message}`
    );
  }

  return (data || [])
    .map((row) =>
      compactText(row.name)
    )
    .filter(Boolean);
}

export async function getUserTherapeuticAreas(
  userId: string
): Promise<string[]> {
  const normalizedUserId =
    compactText(userId);

  if (!normalizedUserId) {
    throw new Error(
      "userId is required"
    );
  }

  const supabase =
    getSupabaseServerClient();
  const { data, error } =
    await supabase
      .from(
        "user_therapeutic_access"
      )
      .select("therapeutic_area")
      .eq(
        "clerk_user_id",
        normalizedUserId
      )
      .order("therapeutic_area", {
        ascending: true,
      });

  if (error) {
    throw new Error(
      `Failed to load user therapeutic-area access: ${error.message}`
    );
  }

  return (data || [])
    .map((row) =>
      compactText(
        row.therapeutic_area
      )
    )
    .filter(Boolean);
}

export function validateTherapeuticAreaAssignments(
  requested: string[],
  active: string[]
): string[] {
  const activeByNormalizedName =
    new Map(
      active.map((area) => [
        area.toLowerCase(),
        area,
      ])
    );
  const invalid = requested.filter(
    (area) =>
      !activeByNormalizedName.has(
        area.toLowerCase()
      )
  );

  if (invalid.length) {
    throw new Error(
      `Unknown or inactive therapeutic areas: ${invalid.join(
        ", "
      )}`
    );
  }

  return Array.from(
    new Set(
      requested.map(
        (area) =>
          activeByNormalizedName.get(
            area.toLowerCase()
          )!
      )
    )
  );
}

export async function replaceUserTherapeuticAreas(
  userId: string,
  value: unknown
): Promise<string[]> {
  const normalizedUserId =
    compactText(userId);

  if (!normalizedUserId) {
    throw new Error(
      "userId is required"
    );
  }

  const requested =
    normalizeTherapeuticAreaAssignments(
      value
    );
  const active =
    await getActiveTherapeuticAreas();
  const canonicalRequested =
    validateTherapeuticAreaAssignments(
      requested,
      active
    );
  const existing =
    await getUserTherapeuticAreas(
      normalizedUserId
    );
  const requestedSet = new Set(
    canonicalRequested
  );
  const existingSet = new Set(
    existing
  );
  const additions =
    canonicalRequested.filter(
      (area) =>
        !existingSet.has(area)
    );
  const removals = existing.filter(
    (area) =>
      !requestedSet.has(area)
  );
  const supabase =
    getSupabaseServerClient();

  if (additions.length) {
    const { error } =
      await supabase
        .from(
          "user_therapeutic_access"
        )
        .upsert(
          additions.map((area) => ({
            clerk_user_id:
              normalizedUserId,
            therapeutic_area: area,
          })),
          {
            onConflict:
              "clerk_user_id,therapeutic_area",
            ignoreDuplicates: true,
          }
        );

    if (error) {
      throw new Error(
        `Failed to assign therapeutic areas: ${error.message}`
      );
    }
  }

  if (removals.length) {
    const { error } =
      await supabase
        .from(
          "user_therapeutic_access"
        )
        .delete()
        .eq(
          "clerk_user_id",
          normalizedUserId
        )
        .in(
          "therapeutic_area",
          removals
        );

    if (error) {
      if (additions.length) {
        await supabase
          .from(
            "user_therapeutic_access"
          )
          .delete()
          .eq(
            "clerk_user_id",
            normalizedUserId
          )
          .in(
            "therapeutic_area",
            additions
          );
      }

      throw new Error(
        `Failed to remove therapeutic areas: ${error.message}`
      );
    }
  }

  return active.filter((area) =>
    requestedSet.has(area)
  );
}

export async function hasTherapeuticAreaAccess(
  userId: string,
  therapeuticArea: string,
  isAdmin = false
): Promise<boolean> {
  if (isAdmin) {
    return true;
  }

  const requested = compactText(
    therapeuticArea
  ).toLowerCase();

  if (!requested) {
    return false;
  }

  const assigned =
    await getUserTherapeuticAreas(
      userId
    );

  return assigned.some(
    (area) =>
      area.toLowerCase() ===
      requested
  );
}
