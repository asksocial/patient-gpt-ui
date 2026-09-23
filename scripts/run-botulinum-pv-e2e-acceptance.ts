import path from "node:path";
import { runBotulinumPvEndToEndAcceptance, writeBotulinumPvEndToEndAcceptanceReport } from "../src/lib/pv/acceptance";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const report = runBotulinumPvEndToEndAcceptance();
const outputPath = argument("--output") || path.resolve(process.cwd(), "reports", "pv", "botulinum-toxin-e2e-acceptance.json");
const written = writeBotulinumPvEndToEndAcceptanceReport(report, outputPath);
console.log(JSON.stringify({ outputPath: written, overallStatus: report.overall_status, productionReadiness: report.production_readiness, counts: report.counts, failures: report.failures }, null, 2));
