export type EvidenceStatementKind =
  | "source_fact"
  | "extracted_claim"
  | "ai_inference"
  | "recommended_action";

export type Citation = {
  evidenceId: string;
  sourceId: string;
  title: string;
  sourceType: string;
  excerpt?: string;
  url?: string;
  publishedAt?: string;
};

export type EvidenceBackedClaim = {
  text: string;
  confidence: number;
  evidenceIds: string[];
};

export type EvidenceStatement = {
  kind: EvidenceStatementKind;
  text: string;
  confidence?: number;
  evidenceIds: string[];
};

export type EvidenceBackedAnswer = {
  answer: string;
  claims: EvidenceBackedClaim[];
  citations: Citation[];
  limitations: string[];
  generatedAt: string;
  statements?: EvidenceStatement[];
};

export type EvidenceValidationIssue = {
  path: string;
  message: string;
};

export function validateEvidenceBackedAnswer(
  answer: EvidenceBackedAnswer
): EvidenceValidationIssue[] {
  const issues:
    EvidenceValidationIssue[] = [];
  const citationIds = new Set(
    answer.citations.map(
      (citation) =>
        citation.evidenceId
    )
  );

  if (!answer.answer.trim()) {
    issues.push({
      path: "answer",
      message:
        "Answer text is required.",
    });
  }

  if (
    Number.isNaN(
      Date.parse(answer.generatedAt)
    )
  ) {
    issues.push({
      path: "generatedAt",
      message:
        "generatedAt must be an ISO timestamp.",
    });
  }

  answer.claims.forEach(
    (claim, index) => {
      if (
        claim.confidence < 0 ||
        claim.confidence > 1
      ) {
        issues.push({
          path: `claims.${index}.confidence`,
          message:
            "Confidence must be between 0 and 1.",
        });
      }

      for (const evidenceId of
        claim.evidenceIds) {
        if (
          !citationIds.has(
            evidenceId
          )
        ) {
          issues.push({
            path: `claims.${index}.evidenceIds`,
            message:
              `Unknown evidence ID: ${evidenceId}`,
          });
        }
      }
    }
  );

  answer.statements?.forEach(
    (statement, index) => {
      if (
        statement.kind ===
          "recommended_action" &&
        statement.evidenceIds
          .length === 0
      ) {
        return;
      }

      for (const evidenceId of
        statement.evidenceIds) {
        if (
          !citationIds.has(
            evidenceId
          )
        ) {
          issues.push({
            path: `statements.${index}.evidenceIds`,
            message:
              `Unknown evidence ID: ${evidenceId}`,
          });
        }
      }
    }
  );

  return issues;
}

export function assertEvidenceBackedAnswer(
  answer: EvidenceBackedAnswer
) {
  const issues =
    validateEvidenceBackedAnswer(
      answer
    );
  if (issues.length) {
    throw new Error(
      issues
        .map(
          (issue) =>
            `${issue.path}: ${issue.message}`
        )
        .join("; ")
    );
  }
}
