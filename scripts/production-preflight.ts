import fs from "fs";
import path from "path";
import {
  execFileSync,
} from "child_process";
import {
  loadEnvConfig,
} from "@next/env";
import {
  createClient,
} from "@supabase/supabase-js";
import {
  listTherapeuticAreaCoverage,
} from "../src/lib/analytics/coverage";
import {
  getKnowledgePersistenceMode,
} from "../src/lib/knowledge/mode";

async function main() {
loadEnvConfig(process.cwd());

const requiredEnvironment = [
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
];
const missingEnvironment =
  requiredEnvironment.filter(
    (key) =>
      !String(
        process.env[key] || ""
      ).trim()
  );

if (missingEnvironment.length) {
  throw new Error(
    `Missing required environment variables: ${missingEnvironment.join(
      ", "
    )}`
  );
}

const canonicalFiles = [
  "data/regen-aesthetics.csv",
  "data/HepB_-_Patients__Caregivers - Mar 11, 2026 - 11 47 15 AM.csv",
  "src/ingestion/curated/gene_therapy.json",
];

for (const relativePath of
  canonicalFiles) {
  const absolutePath = path.resolve(
    process.cwd(),
    relativePath
  );

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `Required canonical corpus is missing: ${relativePath}`
    );
  }

  try {
    execFileSync(
      "git",
      ["check-ignore", "-q", relativePath],
      { stdio: "ignore" }
    );
    throw new Error(
      `Required production corpus is still ignored by Git: ${relativePath}`
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith(
        "Required production corpus"
      )
    ) {
      throw error;
    }
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env
    .SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);
const { data: areas, error } =
  await supabase
    .from("therapeutic_areas")
    .select("name,is_active")
    .eq("is_active", true)
    .order("name");

if (error) {
  throw new Error(
    `Supabase therapeutic-area preflight failed: ${error.message}`
  );
}

const activeAreas = (areas || []).map(
  (item) => item.name
);
const registryAreas =
  listTherapeuticAreaCoverage().map(
    (item) => item.therapeuticArea
  );
const unclassified =
  activeAreas.filter(
    (area) =>
      !registryAreas.includes(area)
  );

if (unclassified.length) {
  throw new Error(
    `Active therapeutic areas are missing from the coverage registry: ${unclassified.join(
      ", "
    )}`
  );
}

const knowledgeMode =
  getKnowledgePersistenceMode();
const { error: knowledgeError } =
  await supabase
    .from("knowledge_snapshots")
    .select("id")
    .limit(1);

const requiredPlatformTables = [
  "intelligence_workspaces",
  "intelligence_work_products",
  "intelligence_knowledge_entities",
  "intelligence_knowledge_relationships",
  "intelligence_audit_events",
  "saved_intelligence_searches",
  "saved_intelligence_prompts",
  "intelligence_monitoring_profiles",
  "intelligence_monitor_runs",
  "intelligence_alerts",
  "intelligence_delivery_outbox",
  "pv_detection_libraries",
  "pv_detection_concepts",
  "pv_sources",
  "pv_screening_runs",
  "pv_sla_policies",
  "pv_records",
  "pv_reviews",
  "pv_transfers",
  "pv_audit_events",
  "pv_reconciliation_runs",
  "pv_reconciliation_issues",
];
const unavailablePlatformTables: string[] = [];
for (const table of requiredPlatformTables) {
  const { error: tableError } = await supabase
    .from(table)
    .select("id")
    .limit(1);
  if (tableError) unavailablePlatformTables.push(table);
}
if (unavailablePlatformTables.length) {
  throw new Error(
    `Supabase platform migrations are incomplete. Missing or inaccessible tables: ${unavailablePlatformTables.join(", ")}`
  );
}

if (
  knowledgeMode === "persistent" &&
  knowledgeError
) {
  throw new Error(
    "ASKSOCIAL_KNOWLEDGE_MODE is persistent, but the knowledge_snapshots table is unavailable."
  );
}

console.log(
  JSON.stringify(
    {
      environment:
        "required variables present",
      activeTherapeuticAreas:
        activeAreas,
      coverageRegistry:
        listTherapeuticAreaCoverage().map(
          (item) => ({
            therapeuticArea:
              item.therapeuticArea,
            status: item.status,
          })
        ),
      canonicalCorpora:
        canonicalFiles,
      knowledgeMode,
      knowledgeTableAvailable:
        !knowledgeError,
      platformPersistenceTables:
        requiredPlatformTables,
    },
    null,
    2
  )
);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
