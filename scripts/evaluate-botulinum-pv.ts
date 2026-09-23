import path from "node:path";
import { runBotulinumPvEvaluation, writePvEvaluationRun } from "../src/lib/pv/evaluation";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const evaluatedAt = new Date().toISOString();
const run = runBotulinumPvEvaluation({ evaluatedAt, basis: "PROVISIONAL_BASELINE" });
const outputDirectory = argument("--output") || path.resolve(process.cwd(), "data", "pv-training", "evaluation", "botulinum-toxin", `${run.report.classifier_version}-${evaluatedAt.replaceAll(":", "-")}`);
writePvEvaluationRun({ outputDirectory, snapshots: run.snapshots, regressionSnapshots: run.regressionSnapshots, report: run.report });
console.log(JSON.stringify({ outputDirectory, report: run.report }, null, 2));
