import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { createHash } from "node:crypto";
import { ingestOpenFda, createOpenFdaRegulatoryCorpusWriter } from "../src/lib/pv/training/regulatory";
import { glp1RegulatoryConfiguration } from "../src/lib/pv/glp1/config";

async function main() {
  if (fs.existsSync(".env.local")) loadEnvFile(".env.local");
  if (!process.env.OPENFDA_API_KEY?.trim()) throw new Error("OPENFDA_API_KEY is required.");
  const args = process.argv.slice(2);
  const allowed = ["--full", "--pages=", "--output-dir=", "--reference="];
  for (const arg of args) if (!allowed.some((prefix) => prefix.endsWith("=") ? arg.startsWith(prefix) : arg === prefix)) throw new Error(`Unknown argument: ${arg}`);
  const value = (key: string) => args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1);
  const pages = Number(value("--pages") || 1);
  if (!Number.isInteger(pages) || pages < 1) throw new Error("--pages must be a positive integer.");
  const output = value("--output-dir") || path.resolve("data/pv-training/regulatory/glp-1", new Date().toISOString().replace(/[:.]/g, "-"));
  const writer = createOpenFdaRegulatoryCorpusWriter(output, glp1RegulatoryConfiguration);
  const result = await ingestOpenFda({
    configuration: glp1RegulatoryConfiguration,
    apiKey: process.env.OPENFDA_API_KEY,
    maxPagesPerQuery: args.includes("--full") ? undefined : pages,
    suspectOnly: true,
    continueOnQueryError: true,
    retainRawRecords: false,
    onUniqueRawRecord: (record) => writer.appendRaw(record),
    onQueryObservation: (observation) => writer.appendObservation(observation),
  });
  writer.finalize(result);
  const records = result.normalizedRecords.filter((record) => record.drugs.some((drug) => drug.is_target_product && drug.drug_role === "suspect"));
  const events = new Map<string, { term: string; reportCount: number; sampleReportIds: string[] }>();
  for (const record of records) {
    for (const term of new Set(record.reactions.map((reaction) => reaction.meddra_preferred_term))) {
      const key = term.toLowerCase();
      const entry = events.get(key) || { term, reportCount: 0, sampleReportIds: [] };
      entry.reportCount += 1;
      if (entry.sampleReportIds.length < 3) entry.sampleReportIds.push(record.safety_report_id);
      events.set(key, entry);
    }
  }
  const summary = {
    schemaVersion: "glp_1_faers_reference_v1", topic: "GLP-1", source: "FDA_FAERS_OPENFDA",
    configurationVersion: result.configurationVersion, productRegistryVersion: result.productRegistryVersion,
    retrievedAt: result.completedAt, startedAt: result.startedAt,
    status: result.status, truncated: result.truncated, suspectOnly: true,
    sampling: args.includes("--full") ? "all_available_pages" : `most_recent_${pages}_page_per_exact_field_query`,
    pageSize: glp1RegulatoryConfiguration.mapping.paging.pageSize,
    uniqueReports: records.length, duplicateObservations: result.duplicateCount,
    malformedRecords: result.malformedRecords.length,
    sourceDocumentation: glp1RegulatoryConfiguration.manifest.sourceDocumentation,
    rawSnapshotManifestSha256: createHash("sha256").update(fs.readFileSync(path.join(output, "manifest.json"))).digest("hex"),
    queryRuns: result.queryRuns.map((run) => ({ product: run.query.productSearched, queryId: run.query.queryId, query: run.query.publicUrl, completed: run.completed, sourceTotal: run.totalReportedByApi, apiLastUpdated: run.apiLastUpdated, retained: run.uniqueRecordsAdded, suspectPostFilterRejected: run.recordsRejectedBySuspectPostFilter, error: run.error || null })),
    reactions: [...events.values()].sort((a, b) => b.reportCount - a.reportCount || a.term.localeCompare(b.term)),
    limitations: ["A bounded reference sample is not the complete FAERS dataset or a representative population.", "Counts describe reaction co-occurrence in retained reports; they do not establish causality, incidence, expectedness, or final reportability.", "Multiple drugs and reactions may coexist without a source-supported pairwise relationship.", "FDA reports are reference evidence, not newly received social reports or sponsor submission cases."],
  };
  if (!records.length) throw new Error(`No GLP-1 suspect reports retained. Audit snapshot saved at ${output}; no reference published.`);
  const reference = value("--reference");
  if (reference) {
    fs.mkdirSync(path.dirname(reference), { recursive: true });
    fs.writeFileSync(reference, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
  }
  console.log(JSON.stringify({ output, reference, reports: records.length, reactions: events.size, queries: result.queryRuns.length, failedQueries: result.queryRuns.filter((run) => run.error).length, status: result.status, truncated: result.truncated }, null, 2));
  if (result.queryRuns.some((run) => run.error)) process.exitCode = 1;
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
