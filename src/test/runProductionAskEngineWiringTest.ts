import {
  askSocial,
} from "../app/api/ask";
import {
  loadCanonicalFindingsForAsk,
} from "../lib/answers/loadCanonicalFindingsForAsk";

const supportedAreas = [
  "Regenerative Aesthetics",
  "Medical Aesthetics",
  "Hepatitis B",
  "Gene Therapy",
];

for (const therapeuticArea of
  supportedAreas) {
  const corpus =
    loadCanonicalFindingsForAsk(
      therapeuticArea
    );

  if (
    corpus.status !== "available" ||
    corpus.findings.length === 0
  ) {
    throw new Error(
      `The production loader did not resolve the ${therapeuticArea} canonical corpus.`
    );
  }
}

const regenerative =
  loadCanonicalFindingsForAsk(
    supportedAreas[0]
  );

if (
  regenerative.status !==
    "available"
) {
  throw new Error(
    "The production loader did not resolve the Regenerative Aesthetics canonical corpus."
  );
}

const result = askSocial(
  "What themes are changing and what should leadership do?",
  regenerative.findings
);

if (
  result.themeSummary.length === 0 ||
  !result.knowledgeSnapshot ||
  !result.executiveIntelligence ||
  result.executiveIntelligence
      .dataQuality
      .datasetFindingCount !==
    regenerative.findings.length
) {
  throw new Error(
    "The real ask pipeline did not return the complete analytical contract."
  );
}

const unsupported =
  loadCanonicalFindingsForAsk(
    "Unsupported Test Area"
  );

if (
  unsupported.status !==
    "unavailable" ||
  unsupported.findings.length !== 0
) {
  throw new Error(
    "Unsupported therapeutic areas must return an explicit unavailable state without synthetic findings."
  );
}

console.log(
  JSON.stringify(
    {
      source:
        regenerative.sourceLabel,
      findingCount:
        regenerative.findings.length,
      intent: result.intent,
      themeCount:
        result.themeSummary.length,
      knowledgeSnapshotKey:
        result.knowledgeSnapshot
          .snapshotKey,
      executiveBriefId:
        result.executiveIntelligence
          .briefId,
      unsupportedStatus:
        unsupported.status,
    },
    null,
    2
  )
);
