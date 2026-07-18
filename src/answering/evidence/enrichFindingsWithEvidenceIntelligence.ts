import type {
  CanonicalFinding,
} from "../models/finding";

import {
  analyzeEvidence,
} from "./analyzeEvidence";

/**
 * Enrich a single CanonicalFinding with Evidence Intelligence.
 */
export function enrichFindingWithEvidenceIntelligence(
  finding: CanonicalFinding
): CanonicalFinding {
  const evidenceIntelligence =
    analyzeEvidence(finding);

  return {
    ...finding,
    evidenceIntelligence,
  } as CanonicalFinding;
}

/**
 * Enrich an array of CanonicalFindings.
 */
export function enrichFindingsWithEvidenceIntelligence(
  findings: CanonicalFinding[]
): CanonicalFinding[] {
  return findings.map(
    enrichFindingWithEvidenceIntelligence
  );
}