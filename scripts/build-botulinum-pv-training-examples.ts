import fs from "node:fs";
import path from "node:path";
import { buildBotulinumPvTrainingExamples, writeBotulinumPvTrainingExamples } from "../src/lib/pv/training/examples";

function argumentValue(argument: string, name: string) {
  return argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : undefined;
}

function parseArguments(arguments_: string[]) {
  const options: { expressionLibraryPath?: string; outputDirectory?: string } = {};
  for (const argument of arguments_) {
    if (argument === "--help") {
      console.log([
        "Usage: npm run examples:botulinum -- [options]",
        "",
        "Options:",
        "  --expression-library=path  social_expression_library.json from an immutable draft or active snapshot.",
        "  --output-dir=path           New immutable training-example output directory.",
      ].join("\n"));
      process.exit(0);
    } else if (argumentValue(argument, "--expression-library") !== undefined) {
      options.expressionLibraryPath = argumentValue(argument, "--expression-library")!.trim();
    } else if (argumentValue(argument, "--output-dir") !== undefined) {
      options.outputDirectory = argumentValue(argument, "--output-dir")!.trim();
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function latestExpressionLibraryPath() {
  const root = path.resolve(process.cwd(), "data/pv-training/expressions/botulinum-toxin");
  if (!fs.existsSync(root)) throw new Error(`No expression-library root found at ${root}.`);
  const candidates = fs.readdirSync(root)
    .map((name) => path.join(root, name))
    .filter((directory) => fs.existsSync(path.join(directory, "social_expression_library.json")) && fs.existsSync(path.join(directory, "manifest.json")))
    .filter((directory) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
      return manifest.status === "draft_pending_pv_medical_review" || manifest.status === "active";
    })
    .sort();
  const latest = candidates.at(-1);
  if (!latest) throw new Error(`No usable expression-library snapshot found under ${root}.`);
  return path.join(latest, "social_expression_library.json");
}

function defaultOutputDirectory() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "data/pv-training/examples/botulinum-toxin", timestamp);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const expressionLibraryPath = path.resolve(options.expressionLibraryPath || latestExpressionLibraryPath());
  const result = buildBotulinumPvTrainingExamples({ expressionLibraryPath });
  const written = writeBotulinumPvTrainingExamples(result, options.outputDirectory || defaultOutputDirectory());
  console.log(JSON.stringify({
    status: written.manifest.status,
    outputDirectory: written.outputDirectory,
    examples: result.examples.length,
    classes: written.manifest.counts.classes,
    examplesPerClass: result.examples.length / written.manifest.counts.classes,
    importantAeConcepts: written.manifest.counts.importantAeConcepts,
    specialSituationTypes: written.manifest.counts.specialSituationTypes,
    pendingHumanReview: written.manifest.counts.pendingHumanReview,
    externallyValidatedHumanAdjudications: 0,
    validation: written.manifest.validation,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
