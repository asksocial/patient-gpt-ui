import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  applyModeEvidencePolicy,
  buildModeAnalysisResult,
  formatModeAnalysisInstructions,
  type ModeAnalysisProfile,
} from "./modeAnalysis";

export type ModeEvaluationResult = {
  suiteId: string;
  modeId: string;
  therapeuticArea: string;
  passed: boolean;
  checks: {
    instructionsConfigured: boolean;
    evidencePolicyApplied: boolean;
    taxonomyConfigured: boolean;
    outputContractCompliant: boolean;
    toolRoutingCompliant: boolean;
    safetyBoundaryPresent: boolean;
  };
  selectedFindingCount: number;
  taxonomySignalCount: number;
  failures: string[];
};

export function runModeTherapeuticAreaEvaluation(params: {
  profile: ModeAnalysisProfile;
  therapeuticArea: string;
  findings: CanonicalFinding[];
  themeSummary?: Array<{
    label?: string;
    percent?: number;
    prevalence?: { eligiblePercent?: number };
    representativeFindingIds?: string[];
  }>;
}): ModeEvaluationResult {
  const { profile, therapeuticArea, findings } = params;
  const selection = applyModeEvidencePolicy(findings, profile);
  const analysis = buildModeAnalysisResult({
    profile,
    therapeuticArea,
    selection,
    themeSummary: params.themeSummary,
  });
  const instructions = formatModeAnalysisInstructions(profile, analysis);
  const requiredSectionIds = new Set(
    profile.outputContract.requiredSections.map((item) => item.id)
  );
  const returnedSectionIds = new Set(
    analysis.sections.map((item) => item.id)
  );
  const checks = {
    instructionsConfigured:
      profile.analysisInstructions.length >= 3 &&
      profile.analysisInstructions.every((instruction) =>
        instructions.includes(instruction)
      ),
    evidencePolicyApplied:
      findings.length === 0 ||
      (selection.diagnostics.inputFindingCount === findings.length &&
        selection.diagnostics.selectedFindingCount > 0 &&
        selection.diagnostics.selectedFindingCount <= findings.length),
    taxonomyConfigured:
      profile.taxonomy.length >= 4 &&
      new Set(profile.taxonomy.map((item) => item.id)).size === profile.taxonomy.length,
    outputContractCompliant:
      analysis.outputContract.id === profile.outputContract.id &&
      requiredSectionIds.size === returnedSectionIds.size &&
      [...requiredSectionIds].every((sectionId) => returnedSectionIds.has(sectionId)) &&
      analysis.sections.every((item) => item.summary.trim().length > 0),
    toolRoutingCompliant:
      profile.toolRouting.passiveTools.length > 0 &&
      analysis.routedTools.every((toolId) =>
        profile.toolRouting.passiveTools.includes(toolId)
      ) &&
      analysis.routedTools.every((toolId) =>
        !profile.toolRouting.actionTools.includes(toolId)
      ),
    safetyBoundaryPresent:
      profile.safetyBoundary.length >= 40 &&
      analysis.limitations.includes(profile.safetyBoundary),
  };
  const failures = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => check);

  return {
    suiteId: profile.evaluationSuiteId,
    modeId: profile.modeId,
    therapeuticArea,
    passed: failures.length === 0,
    checks,
    selectedFindingCount: selection.diagnostics.selectedFindingCount,
    taxonomySignalCount: analysis.taxonomySignals.length,
    failures,
  };
}
