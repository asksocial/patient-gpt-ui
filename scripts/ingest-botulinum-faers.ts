import path from "node:path";
import { createOpenFdaRegulatoryCorpusWriter, ingestBotulinumOpenFda } from "../src/lib/pv/training/regulatory";

type CliOptions = {
  outputDirectory?: string;
  products: string[];
  suspectOnly: boolean;
  maxRecords?: number;
  maxPagesPerQuery?: number;
  allowPartial: boolean;
};

function positiveInteger(name: string, value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function argumentValue(argument: string, name: string) {
  return argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : undefined;
}

function parseArguments(arguments_: string[]): CliOptions {
  const options: CliOptions = { products: [], suspectOnly: false, allowPartial: false };
  for (const argument of arguments_) {
    if (argument === "--suspect-only") options.suspectOnly = true;
    else if (argument === "--allow-partial") options.allowPartial = true;
    else if (argument === "--help") {
      console.log([
        "Usage: npm run faers:botulinum -- [options]",
        "",
        "Options:",
        "  --product=BOTOX              Limit retrieval to one or more configured targets (comma-separated or repeated).",
        "  --suspect-only               Query and post-filter for the target drug in a suspect role.",
        "  --max-records=100            Stop after N unique reports; marks the snapshot partial.",
        "  --max-pages-per-query=2      Stop each query after N pages; marks the snapshot partial.",
        "  --output-dir=path            Select an unused immutable snapshot directory.",
        "  --allow-partial              Exit successfully when a deliberately limited or failed snapshot is written.",
        "",
        "Environment: OPENFDA_API_KEY is required by the live corpus-ingestion command.",
      ].join("\n"));
      process.exit(0);
    } else if (argumentValue(argument, "--product") !== undefined) {
      options.products.push(...argumentValue(argument, "--product")!.split(",").map((value) => value.trim()).filter(Boolean));
    } else if (argumentValue(argument, "--max-records") !== undefined) {
      options.maxRecords = positiveInteger("--max-records", argumentValue(argument, "--max-records")!);
    } else if (argumentValue(argument, "--max-pages-per-query") !== undefined) {
      options.maxPagesPerQuery = positiveInteger("--max-pages-per-query", argumentValue(argument, "--max-pages-per-query")!);
    } else if (argumentValue(argument, "--output-dir") !== undefined) {
      options.outputDirectory = argumentValue(argument, "--output-dir")!.trim();
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function defaultOutputDirectory() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "data", "pv-training", "regulatory", "botulinum-toxin", timestamp);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!process.env.OPENFDA_API_KEY?.trim()) {
    throw new Error("OPENFDA_API_KEY is required. Obtain a key from https://open.fda.gov/apis/authentication/ and add it to the local or deployment environment.");
  }
  const writer = createOpenFdaRegulatoryCorpusWriter(options.outputDirectory || defaultOutputDirectory());
  const result = await ingestBotulinumOpenFda({
    apiKey: process.env.OPENFDA_API_KEY,
    products: options.products,
    suspectOnly: options.suspectOnly,
    maxRecords: options.maxRecords,
    maxPagesPerQuery: options.maxPagesPerQuery,
    continueOnQueryError: true,
    retainRawRecords: false,
    onUniqueRawRecord: (record) => writer.appendRaw(record),
    onQueryObservation: (input) => writer.appendObservation(input),
  });
  const written = writer.finalize(result);
  console.log(JSON.stringify({
    status: result.status,
    outputDirectory: written.outputDirectory,
    normalizedRecords: result.normalizedRecords.length,
    duplicateObservations: result.duplicateCount,
    malformedRecords: result.malformedRecords.length,
    failedQueries: result.queryRuns.filter((run) => run.error).length,
    truncated: result.truncated,
  }, null, 2));
  if (result.status !== "complete" && !options.allowPartial) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
