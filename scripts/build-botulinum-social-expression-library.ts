import fs from "node:fs";
import path from "node:path";
import { buildBotulinumSocialExpressionLibrary, writeBotulinumSocialExpressionLibrary } from "../src/lib/pv/training/expressions";

function argumentValue(argument: string, name: string) {
  return argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : undefined;
}

function parseArguments(arguments_: string[]) {
  const options: { taxonomyPath?: string; outputDirectory?: string } = {};
  for (const argument of arguments_) {
    if (argument === "--help") {
      console.log([
        "Usage: npm run expressions:botulinum -- [options]",
        "",
        "Options:",
        "  --taxonomy=path    taxonomy.json from an immutable Botulinum toxin taxonomy snapshot.",
        "  --output-dir=path  New immutable expression-library output directory.",
      ].join("\n"));
      process.exit(0);
    } else if (argumentValue(argument, "--taxonomy") !== undefined) {
      options.taxonomyPath = argumentValue(argument, "--taxonomy")!.trim();
    } else if (argumentValue(argument, "--output-dir") !== undefined) {
      options.outputDirectory = argumentValue(argument, "--output-dir")!.trim();
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function latestTaxonomyPath() {
  const root = path.resolve(process.cwd(), "data/pv-training/taxonomy/botulinum-toxin");
  if (!fs.existsSync(root)) throw new Error(`No taxonomy root found at ${root}.`);
  const candidates = fs.readdirSync(root)
    .map((name) => path.join(root, name))
    .filter((directory) => fs.existsSync(path.join(directory, "taxonomy.json")) && fs.existsSync(path.join(directory, "manifest.json")))
    .filter((directory) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
      return manifest.status === "draft_pending_pv_review" || manifest.status === "active";
    })
    .sort();
  const latest = candidates.at(-1);
  if (!latest) throw new Error(`No usable taxonomy snapshot found under ${root}.`);
  return path.join(latest, "taxonomy.json");
}

function defaultOutputDirectory() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "data/pv-training/expressions/botulinum-toxin", timestamp);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const taxonomyPath = path.resolve(options.taxonomyPath || latestTaxonomyPath());
  const result = buildBotulinumSocialExpressionLibrary({ taxonomyPath });
  const written = writeBotulinumSocialExpressionLibrary(result, options.outputDirectory || defaultOutputDirectory());
  console.log(JSON.stringify({
    status: written.manifest.status,
    outputDirectory: written.outputDirectory,
    taxonomyConcepts: result.concepts.length,
    expressions: result.expressions.length,
    generatedExpressions: written.manifest.counts.generatedExpressions,
    curatedExpressions: written.manifest.counts.curatedExpressions,
    highPriorityConcepts: written.manifest.counts.highPriorityConcepts,
    conceptsWithNoExpressions: written.manifest.counts.conceptsWithNoExpressions,
    conceptsRequiringManualReview: result.qualityControl.length,
    productionEligibleConcepts: 0,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
