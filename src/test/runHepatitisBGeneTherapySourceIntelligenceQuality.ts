import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSourceIntelligence } from "../lib/answers/buildSourceIntelligence";
import { loadCanonicalFindingsForAsk } from "../lib/answers/loadCanonicalFindingsForAsk";
import { askSocial } from "../app/api/ask";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sourceType(finding: any) {
  return finding.sourceType || finding.evidence?.[0]?.sourceType || "unknown";
}

for (const therapeuticArea of ["Hepatitis B", "Gene Therapy"]) {
  const corpus = loadCanonicalFindingsForAsk(therapeuticArea);
  assert(corpus.status === "available", `${therapeuticArea} corpus must be available.`);

  const curatedCount = corpus.findings.filter(
    (finding) => sourceType(finding) === "curated"
  ).length;
  const socialCount = corpus.findings.filter(
    (finding) => sourceType(finding) === "live"
  ).length;

  assert(curatedCount > 0, `${therapeuticArea} must retain curated findings.`);
  assert(socialCount > 0, `${therapeuticArea} must retain social findings.`);

  const sourceIntelligence = buildSourceIntelligence(corpus.findings);
  assert(
    sourceIntelligence.curatedMentions.length > 0,
    `${therapeuticArea} Search must expose representative curated mentions.`
  );
  assert(
    sourceIntelligence.socialMentions.length > 0,
    `${therapeuticArea} Search must expose representative social mentions.`
  );
  assert(
    sourceIntelligence.curatedThemes.length > 0 &&
      sourceIntelligence.socialThemes.length > 0,
    `${therapeuticArea} must provide both source-aware theme fallbacks.`
  );

  const intelligence = askSocial(
    "What are people saying right now?",
    corpus.findings
  );
  const aggregatedOrigins = intelligence.themeSummary.reduce(
    (origins, theme) => {
      for (const [origin, detail] of Object.entries(
        theme.sourceAggregation?.dataOrigins || {}
      )) {
        origins[origin] = (origins[origin] || 0) + Number(detail.count || 0);
      }
      return origins;
    },
    {} as Record<string, number>
  );

  assert(
    intelligence.answer.liveDataStatus === "extends",
    `${therapeuticArea} responses must identify social intelligence as extending curated intelligence.`
  );
  assert(
    aggregatedOrigins.curated > 0 && aggregatedOrigins.live > 0,
    `${therapeuticArea} theme intelligence must aggregate both curated and social evidence.`
  );
  assert(
    intelligence.knowledgeSnapshot && intelligence.executiveIntelligence,
    `${therapeuticArea} must carry the combined corpus into Knowledge Graph and Executive Brief outputs.`
  );
}

const workspace = readFileSync(
  join(process.cwd(), "src/components/WorkspaceShell.jsx"),
  "utf8"
);
const askRoute = readFileSync(
  join(process.cwd(), "src/app/api/ask/route.ts"),
  "utf8"
);

for (const contract of [
  "Representative curated mentions",
  "Representative social mentions",
  "sourceIntelligence:",
]) {
  assert(workspace.includes(contract), `Search rendering is missing ${contract}.`);
}

assert(
  askRoute.includes("buildSourceIntelligence") &&
    askRoute.includes("sourceIntelligence,") &&
    askRoute.includes("sourceIntelligence.socialThemes"),
  "The Ask API must use canonical curated/social evidence as the shared Search fallback."
);

assert(
  !workspace.includes("Live Intelligence") &&
    !workspace.includes("Structured Live Theme") &&
    !workspace.includes("Live Signal"),
  "User-facing Search terminology must say Social Intelligence rather than Live Intelligence."
);

console.log("Hepatitis B and Gene Therapy source-intelligence checks passed.");
