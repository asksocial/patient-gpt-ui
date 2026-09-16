import fs from "node:fs";
import path from "node:path";
import { getBotulinumRegulatoryCorpusManifest } from "./config";
import type { OpenFdaIngestionResult } from "./types";

function writeJsonLines(filePath: string, rows: unknown[]) {
  const value = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.writeFileSync(filePath, value ? `${value}\n` : "", { encoding: "utf8", flag: "wx" });
}

export function writeOpenFdaRegulatoryCorpus(result: OpenFdaIngestionResult, outputDirectory: string) {
  const resolved = path.resolve(outputDirectory);
  if (fs.existsSync(resolved)) throw new Error(`Output directory already exists: ${resolved}. Choose a new directory to preserve immutable corpus snapshots.`);
  fs.mkdirSync(resolved, { recursive: true });
  const manifest = getBotulinumRegulatoryCorpusManifest();
  writeJsonLines(path.join(resolved, "raw-records.jsonl"), result.rawRecords);
  writeJsonLines(path.join(resolved, "query-observations.jsonl"), result.rawRecords.flatMap((record) => record.observations.map((observation) => ({ deduplicationKey: record.deduplicationKey, observation }))));
  writeJsonLines(path.join(resolved, "normalized-records.jsonl"), result.normalizedRecords);
  writeJsonLines(path.join(resolved, "malformed-records.jsonl"), result.malformedRecords);
  const outputManifest = {
    schemaVersion: "1.0.0",
    corpusType: "regulatory_case_corpus",
    topic: manifest.topic,
    source: manifest.source,
    sourceDocumentation: manifest.sourceDocumentation,
    status: result.status,
    truncated: result.truncated,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    configurationVersion: result.configurationVersion,
    productRegistryVersion: result.productRegistryVersion,
    sourceMappingVersion: result.sourceMappingVersion,
    recordCounts: {
      rawUnique: result.rawRecords.length,
      normalized: result.normalizedRecords.length,
      queryObservations: result.rawRecords.reduce((count, record) => count + record.observations.length, 0),
      duplicateObservations: result.duplicateCount,
      malformed: result.malformedRecords.length,
    },
    queryRuns: result.queryRuns,
    files: {
      raw: "raw-records.jsonl",
      queryObservations: "query-observations.jsonl",
      normalized: "normalized-records.jsonl",
      malformed: "malformed-records.jsonl",
    },
    regulatoryPosture: manifest.regulatoryPosture,
  };
  fs.writeFileSync(path.join(resolved, "manifest.json"), `${JSON.stringify(outputManifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return { outputDirectory: resolved, manifest: outputManifest };
}

export function createOpenFdaRegulatoryCorpusWriter(outputDirectory: string) {
  const resolved = path.resolve(outputDirectory);
  if (fs.existsSync(resolved)) throw new Error(`Output directory already exists: ${resolved}. Choose a new directory to preserve immutable corpus snapshots.`);
  fs.mkdirSync(resolved, { recursive: true });
  const rawPath = path.join(resolved, "raw-records.jsonl");
  const observationPath = path.join(resolved, "query-observations.jsonl");
  fs.writeFileSync(rawPath, "", { encoding: "utf8", flag: "wx" });
  fs.writeFileSync(observationPath, "", { encoding: "utf8", flag: "wx" });
  let rawCount = 0;
  let observationCount = 0;
  return {
    outputDirectory: resolved,
    appendRaw(record: OpenFdaIngestionResult["rawRecords"][number]) {
      fs.appendFileSync(rawPath, `${JSON.stringify(record)}\n`, "utf8");
      rawCount += 1;
    },
    appendObservation(input: { deduplicationKey: string; observation: unknown }) {
      fs.appendFileSync(observationPath, `${JSON.stringify(input)}\n`, "utf8");
      observationCount += 1;
    },
    finalize(result: OpenFdaIngestionResult) {
      writeJsonLines(path.join(resolved, "normalized-records.jsonl"), result.normalizedRecords);
      writeJsonLines(path.join(resolved, "malformed-records.jsonl"), result.malformedRecords);
      const corpusManifest = getBotulinumRegulatoryCorpusManifest();
      const outputManifest = {
        schemaVersion: "1.0.0",
        corpusType: "regulatory_case_corpus",
        topic: corpusManifest.topic,
        source: corpusManifest.source,
        sourceDocumentation: corpusManifest.sourceDocumentation,
        status: result.status,
        truncated: result.truncated,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        configurationVersion: result.configurationVersion,
        productRegistryVersion: result.productRegistryVersion,
        sourceMappingVersion: result.sourceMappingVersion,
        recordCounts: {
          rawUnique: rawCount,
          normalized: result.normalizedRecords.length,
          queryObservations: observationCount,
          duplicateObservations: result.duplicateCount,
          malformed: result.malformedRecords.length,
        },
        queryRuns: result.queryRuns,
        files: {
          raw: "raw-records.jsonl",
          queryObservations: "query-observations.jsonl",
          normalized: "normalized-records.jsonl",
          malformed: "malformed-records.jsonl",
        },
        regulatoryPosture: corpusManifest.regulatoryPosture,
      };
      fs.writeFileSync(path.join(resolved, "manifest.json"), `${JSON.stringify(outputManifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      return { outputDirectory: resolved, manifest: outputManifest };
    },
  };
}
