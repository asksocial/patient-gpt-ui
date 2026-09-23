import fs from "node:fs";
import path from "node:path";

export function writeBotulinumPvEndToEndAcceptanceReport(report: unknown, outputPath: string) {
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  return resolved;
}
