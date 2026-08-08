import {
  enrichFindingsWithEvidenceIntelligence,
} from "../answering/evidence";
import type {
  CanonicalFinding,
} from "../answering/models/finding";
import {
  MODE_ANALYSIS_PROFILES,
  applyModeEvidencePolicy,
  runModeTherapeuticAreaEvaluation,
} from "../lib/intelligence-platform";
import {
  listTherapeuticAreaCoverage,
} from "../lib/analytics/coverage";
import {
  loadCanonicalFindingsForAsk,
} from "../lib/answers/loadCanonicalFindingsForAsk";
import {
  askSocial,
} from "../app/api/ask";
import {
  readFileSync,
} from "node:fs";
import {
  join,
} from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const coverage = listTherapeuticAreaCoverage();
const validatedAreas = coverage.filter((item) => item.status === "validated");
const conversationOnlyAreas = coverage.filter((item) => item.status === "conversation_only");

assert(MODE_ANALYSIS_PROFILES.length === 8, "Every Intelligence Mode must have an executable analysis profile.");
assert(validatedAreas.length >= 4, "The evaluation matrix requires every validated therapeutic-area corpus.");
assert(conversationOnlyAreas.length >= 1, "Conversation-only areas must remain explicitly represented in evaluation coverage.");

for (const key of [
  "modeId",
  "evaluationSuiteId",
  "outputContract",
] as const) {
  const values = MODE_ANALYSIS_PROFILES.map((profile) =>
    key === "outputContract" ? profile.outputContract.id : profile[key]
  );
  assert(
    new Set(values).size === MODE_ANALYSIS_PROFILES.length,
    `Each mode requires a distinct ${key}.`
  );
}

const evaluations = [];
for (const area of validatedAreas) {
  const corpus = loadCanonicalFindingsForAsk(area.therapeuticArea);
  assert(corpus.status === "available", `${area.therapeuticArea} must load for mode evaluation.`);

  for (const profile of MODE_ANALYSIS_PROFILES) {
    const result = askSocial(
      "What are the most important conversation signals and what do they mean?",
      corpus.findings,
      { modeId: profile.modeId }
    );
    const evaluation = runModeTherapeuticAreaEvaluation({
      profile,
      therapeuticArea: area.therapeuticArea,
      findings: enrichFindingsWithEvidenceIntelligence(corpus.findings),
      themeSummary: result.themeSummary,
    });
    assert(evaluation.passed, `${profile.modeId} failed ${area.therapeuticArea}: ${evaluation.failures.join(", ")}`);
    assert(result.modeAnalysis?.modeId === profile.modeId, `${profile.modeId} was not applied by the AskSocial engine.`);
    assert(
      result.modeAnalysis.sections.length === profile.outputContract.requiredSections.length,
      `${profile.modeId} did not satisfy its output contract.`
    );
    assert(result.modeAnalysis.evidenceSelection.selectedFindingCount > 0, `${profile.modeId} selected no evidence for ${area.therapeuticArea}.`);
    evaluations.push(evaluation);
  }
}

const conversationOnlyEvaluations = conversationOnlyAreas.flatMap((area) =>
  MODE_ANALYSIS_PROFILES.map((profile) =>
    runModeTherapeuticAreaEvaluation({
      profile,
      therapeuticArea: area.therapeuticArea,
      findings: [],
      themeSummary: [],
    })
  )
);
assert(
  conversationOnlyEvaluations.every((item) => item.passed),
  "Every mode must retain its instructions, taxonomy, contract, routing, and safety boundary for conversation-only areas."
);
const unavailableCoverage = conversationOnlyAreas.map((area) => ({
  therapeuticArea: area.therapeuticArea,
  expectedStatus: "mode_lens_available_finding_analysis_blocked",
  reason: area.reason,
  modeSuiteIds: MODE_ANALYSIS_PROFILES.map((profile) => profile.evaluationSuiteId),
}));
assert(
  unavailableCoverage.every((item) => item.reason && item.modeSuiteIds.length === 8),
  "Every conversation-only area must disclose why specialized evaluation cannot run."
);

function finding(
  findingId: string,
  text: string,
  sourceType: "live" | "curated" = "live"
): CanonicalFinding {
  return {
    findingId,
    findingType: "other",
    canonicalClaim: text,
    summary: text,
    therapeuticArea: "mode_policy_test",
    countries: ["United States"],
    personas: [],
    platforms: ["forum"],
    symptoms: [],
    treatments: [],
    lifecycleStages: [],
    intentLabels: [],
    confidence: 0.9,
    relevanceScore: 0.9,
    evidenceStrength: 0.9,
    evidence: [
      {
        sourceType,
        sourceId: findingId,
        excerpt: text,
        platform: "forum",
      },
    ],
    normalizedLabels: [],
    semanticFingerprint: findingId,
  };
}

const policyCorpus = enrichFindingsWithEvidenceIntelligence([
  finding("patient", "I experienced a new side effect after the treatment and asked my doctor."),
  finding("research", "A peer reviewed clinical study reports safety and efficacy evidence.", "curated"),
  finding("promotion", "Buy this product now with our sponsored clinic discount."),
]);
const promotionalFixture = policyCorpus.find(
  (item) => item.findingId === "promotion"
) as CanonicalFinding & {
  evidenceIntelligence?: Record<string, unknown>;
};
assert(promotionalFixture?.evidenceIntelligence, "Promotional evidence fixture must be enriched.");
promotionalFixture.evidenceIntelligence = {
  ...promotionalFixture.evidenceIntelligence,
  evidenceClass: "sponsored_content",
  voice: "corporate",
  isPromotional: true,
  commercialIntent: "high",
  qualityScore: 0,
};
const scientific = MODE_ANALYSIS_PROFILES.find((profile) => profile.modeId === "scientific_intelligence_advisor");
const safety = MODE_ANALYSIS_PROFILES.find((profile) => profile.modeId === "pharmacovigilance_assistant");
assert(scientific && safety, "Scientific and Safety profiles are required.");
const scientificSelection = applyModeEvidencePolicy(policyCorpus, scientific);
const safetySelection = applyModeEvidencePolicy(policyCorpus, safety);
assert(
  !scientificSelection.findings.some((item) => item.findingId === "promotion"),
  "Scientific Intelligence must exclude promotional evidence from analysis."
);
assert(
  safetySelection.findings.some((item) => item.findingId === "promotion"),
  "Safety Intelligence must retain promotional sources in broad screening scope."
);

const route = readFileSync(join(process.cwd(), "src/app/api/ask/route.ts"), "utf8");
const workspace = readFileSync(join(process.cwd(), "src/components/WorkspaceShell.jsx"), "utf8");
const composer = readFileSync(join(process.cwd(), "src/lib/answers/composeHybridAnswer.ts"), "utf8");
for (const contract of [
  "selectedAgent?.id",
  "modeAnalysis:",
]) {
  assert(route.includes(contract), `Ask API is missing mode wiring: ${contract}`);
}
for (const contract of [
  "ModeAnalysisView",
  "modeAnalysis:",
  "Domain taxonomy signals",
  "Analysis boundary",
]) {
  assert(workspace.includes(contract), `Workspace is missing specialized mode output: ${contract}`);
}
for (const contract of [
  "formatModeAnalysisInstructions",
  "input.modeAnalysis?.routedTools",
  "required mode output section",
]) {
  assert(composer.includes(contract), `Hybrid synthesis is missing mode behavior: ${contract}`);
}

console.log(
  JSON.stringify(
    {
      profileCount: MODE_ANALYSIS_PROFILES.length,
      validatedTherapeuticAreas: validatedAreas.map((item) => item.therapeuticArea),
      evaluatedModeAreaPairs: evaluations.length,
      evaluatedConversationOnlyModeAreaPairs: conversationOnlyEvaluations.length,
      conversationOnlyCoverage: unavailableCoverage,
      distinctEvidencePolicies: {
        scientificPromotionalEvidence: "excluded",
        safetyPromotionalEvidence: "screened",
      },
      outputContractsSatisfied: evaluations.every((item) => item.checks.outputContractCompliant),
      toolRoutingSatisfied: evaluations.every((item) => item.checks.toolRoutingCompliant),
    },
    null,
    2
  )
);
