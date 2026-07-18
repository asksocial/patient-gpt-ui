import {
  getSupabaseServerClient,
} from "../supabase/server";
import type {
  ThemeKnowledgeSnapshot,
} from "../../answering/knowledge";

export type KnowledgePrincipalType =
  | "organization"
  | "user";

export type KnowledgePrincipal = {
  principalId: string;
  principalType:
    KnowledgePrincipalType;
};

export type StoredKnowledgeSnapshot = {
  id: string;
  snapshot: ThemeKnowledgeSnapshot;
  createdAt: string;
};

function assertPrincipal(
  principal: KnowledgePrincipal
): void {
  if (!principal.principalId.trim()) {
    throw new Error(
      "A knowledge-store principal is required."
    );
  }
}

export function isThemeKnowledgeSnapshot(
  value: unknown
): value is ThemeKnowledgeSnapshot {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const snapshot = value as Partial<
    ThemeKnowledgeSnapshot
  >;

  return (
    snapshot.schemaVersion ===
      "theme_knowledge_snapshot_v1" &&
    typeof snapshot.snapshotKey ===
      "string" &&
    typeof snapshot.therapeuticArea ===
      "string" &&
    typeof snapshot.contentHash ===
      "string" &&
    Array.isArray(
      snapshot.themeRecords
    ) &&
    Array.isArray(
      snapshot.relationships
    ) &&
    Array.isArray(
      snapshot.strategicImplications
    )
  );
}

export async function saveThemeKnowledgeSnapshot(
  principal: KnowledgePrincipal,
  snapshot: ThemeKnowledgeSnapshot,
  createdBy?: string
): Promise<StoredKnowledgeSnapshot> {
  assertPrincipal(principal);

  if (
    !isThemeKnowledgeSnapshot(
      snapshot
    )
  ) {
    throw new Error(
      "Invalid theme knowledge snapshot."
    );
  }

  const supabase =
    getSupabaseServerClient();

  const snapshotRow = {
    principal_id:
      principal.principalId,
    principal_type:
      principal.principalType,
    therapeutic_area:
      snapshot.therapeuticArea,
    snapshot_key:
      snapshot.snapshotKey,
    schema_version:
      snapshot.schemaVersion,
    content_hash:
      snapshot.contentHash,
    analysis_start:
      snapshot.analysisStart || null,
    analysis_end:
      snapshot.analysisEnd || null,
    granularity:
      snapshot.granularity || null,
    dataset_finding_count:
      snapshot.datasetFindingCount,
    dated_finding_count:
      snapshot.datedFindingCount,
    temporal_coverage_percent:
      snapshot.temporalCoveragePercent,
    source_query:
      snapshot.sourceQuery || null,
    created_by:
      createdBy || null,
    payload: snapshot,
  };

  const {
    data: stored,
    error: snapshotError,
  } = await supabase
    .from("knowledge_snapshots")
    .upsert(snapshotRow, {
      onConflict:
        "principal_id,therapeutic_area,snapshot_key",
    })
    .select("id, created_at")
    .single();

  if (snapshotError || !stored) {
    throw new Error(
      `Failed to save knowledge snapshot: ${snapshotError?.message || "missing stored row"}`
    );
  }

  const themeRows =
    snapshot.themeRecords.map(
      (record) => ({
        snapshot_id: stored.id,
        principal_id:
          principal.principalId,
        therapeutic_area:
          snapshot.therapeuticArea,
        theme_id: record.themeId,
        theme_label: record.label,
        eligible_percent:
          record.eligiblePercent,
        evidence_weighted_percent:
          record.evidenceWeightedPercent,
        confidence: record.confidence,
        triangulation:
          record.triangulation,
        trajectory:
          record.trajectory,
        percentage_point_change:
          record.percentagePointChange,
        persistence_percent:
          record.persistencePercent,
        record_payload: record,
      })
    );

  if (themeRows.length > 0) {
    const { error: themeError } =
      await supabase
        .from(
          "theme_knowledge_records"
        )
        .upsert(themeRows, {
          onConflict:
            "snapshot_id,theme_id",
        });

    if (themeError) {
      throw new Error(
        `Failed to save theme knowledge records: ${themeError.message}`
      );
    }
  }

  return {
    id: String(stored.id),
    snapshot,
    createdAt: String(
      stored.created_at ||
        snapshot.createdAt
    ),
  };
}

export async function listThemeKnowledgeSnapshots(
  principal: KnowledgePrincipal,
  therapeuticArea: string,
  limit = 20
): Promise<StoredKnowledgeSnapshot[]> {
  assertPrincipal(principal);

  const normalizedLimit =
    Math.max(
      1,
      Math.min(
        100,
        Math.floor(limit)
      )
    );
  const supabase =
    getSupabaseServerClient();
  const { data, error } =
    await supabase
      .from("knowledge_snapshots")
      .select(
        "id, payload, created_at"
      )
      .eq(
        "principal_id",
        principal.principalId
      )
      .eq(
        "therapeutic_area",
        therapeuticArea
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(normalizedLimit);

  if (error) {
    throw new Error(
      `Failed to load knowledge snapshots: ${error.message}`
    );
  }

  return (data || [])
    .filter((row) =>
      isThemeKnowledgeSnapshot(
        row.payload
      )
    )
    .map((row) => ({
      id: String(row.id),
      snapshot:
        row.payload as ThemeKnowledgeSnapshot,
      createdAt: String(
        row.created_at
      ),
    }));
}

export async function getThemeKnowledgeSnapshot(
  principal: KnowledgePrincipal,
  snapshotId: string
): Promise<StoredKnowledgeSnapshot | null> {
  assertPrincipal(principal);

  const supabase =
    getSupabaseServerClient();
  const { data, error } =
    await supabase
      .from("knowledge_snapshots")
      .select(
        "id, payload, created_at"
      )
      .eq("id", snapshotId)
      .eq(
        "principal_id",
        principal.principalId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load knowledge snapshot: ${error.message}`
    );
  }

  if (
    !data ||
    !isThemeKnowledgeSnapshot(
      data.payload
    )
  ) {
    return null;
  }

  return {
    id: String(data.id),
    snapshot:
      data.payload as ThemeKnowledgeSnapshot,
    createdAt: String(
      data.created_at
    ),
  };
}
