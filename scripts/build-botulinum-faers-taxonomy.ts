import fs from "node:fs";
import path from "node:path";
import { buildBotulinumReactionTaxonomy, writeBotulinumReactionTaxonomy } from "../src/lib/pv/training/taxonomy";

function argumentValue(argument: string, name: string) {
  return argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : undefined;
}

function parseArguments(arguments_: string[]) {
  const options: { sourceDirectory?: string; outputDirectory?: string } = {};
  for (const argument of arguments_) {
    if (argument === "--help") {
      console.log([
        "Usage: npm run taxonomy:botulinum -- [options]",
        "",
        "Options:",
        "  --source-dir=path   Complete regulatory corpus snapshot containing normalized-records.jsonl.",
        "  --output-dir=path   New immutable taxonomy output directory.",
      ].join("\n"));
      process.exit(0);
    } else if (argumentValue(argument, "--source-dir") !== undefined) {
      options.sourceDirectory = argumentValue(argument, "--source-dir")!.trim();
    } else if (argumentValue(argument, "--output-dir") !== undefined) {
      options.outputDirectory = argumentValue(argument, "--output-dir")!.trim();
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function latestCompleteRegulatorySnapshot() {
  const root = path.resolve(process.cwd(), "data/pv-training/regulatory/botulinum-toxin");
  if (!fs.existsSync(root)) throw new Error(`No regulatory corpus root found at ${root}.`);
  const candidates = fs.readdirSync(root)
    .map((name) => ({ name, directory: path.join(root, name) }))
    .filter(({ directory }) => fs.existsSync(path.join(directory, "manifest.json")) && fs.existsSync(path.join(directory, "normalized-records.jsonl")))
    .filter(({ directory }) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
      return manifest.status === "complete" && !manifest.truncated;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const latest = candidates.at(-1);
  if (!latest) throw new Error(`No complete, untruncated regulatory corpus snapshot found under ${root}.`);
  return latest.directory;
}

function defaultOutputDirectory() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "data/pv-training/taxonomy/botulinum-toxin", timestamp);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourceDirectory = path.resolve(options.sourceDirectory || latestCompleteRegulatorySnapshot());
  const result = await buildBotulinumReactionTaxonomy({ sourceDirectory });
  const written = writeBotulinumReactionTaxonomy(result, options.outputDirectory || defaultOutputDirectory());
  console.log(JSON.stringify({
    status: written.manifest.status,
    outputDirectory: written.outputDirectory,
    uniqueReactionPreferredTerms: result.records.length,
    sourceCases: result.source.casesRead,
    seriousCases: result.source.seriousCases,
    recordsMissingReactionTerminology: result.source.casesMissingReactionTerminology,
    validReactionOccurrences: result.source.validReactionOccurrences,
    reconciliation: written.manifest.reconciliation,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
