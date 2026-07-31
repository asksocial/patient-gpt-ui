import fs from "node:fs";
import path from "node:path";
import { scoreCrossWorkspaceRecord } from "../lib/intelligence-platform";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const titleMatch = scoreCrossWorkspaceRecord("patient trust", { title: "Patient trust analysis", payload: {} });
const bodyMatch = scoreCrossWorkspaceRecord("patient trust", { title: "Analysis", payload: { summary: "Patient trust is changing" } });
assert(titleMatch > bodyMatch, "Title matches should outrank body-only matches.");
assert(scoreCrossWorkspaceRecord("unknown", { title: "Patient trust", payload: {} }) === 0, "Unmatched records must be excluded.");

const migration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202607310002_create_saved_intelligence_library.sql"), "utf8");
assert(migration.includes("saved_intelligence_searches"), "Saved searches table is required.");
assert(migration.includes("saved_intelligence_prompts"), "Saved prompts table is required.");
assert(migration.match(/enable row level security/g)?.length === 2, "Both library tables must enable RLS.");

console.log("Intelligence library quality checks passed.");
