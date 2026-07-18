export type AnalyticalCoverageStatus =
  | "validated"
  | "conversation_only";

export type TherapeuticAreaCoverage = {
  therapeuticArea: string;
  therapeuticAreaId: string;
  status: AnalyticalCoverageStatus;
  executiveIntelligenceAvailable: boolean;
  longitudinalIntelligenceAvailable: boolean;
  sourceLabel?: string;
  reason?: string;
};

const COVERAGE: TherapeuticAreaCoverage[] = [
  {
    therapeuticArea:
      "Regenerative Aesthetics",
    therapeuticAreaId:
      "regenerative_aesthetics",
    status: "validated",
    executiveIntelligenceAvailable:
      true,
    longitudinalIntelligenceAvailable:
      true,
    sourceLabel:
      "Regenerative Aesthetics Meltwater canonical corpus",
  },
  {
    therapeuticArea: "Hepatitis B",
    therapeuticAreaId:
      "hepatitis_b",
    status: "validated",
    executiveIntelligenceAvailable:
      true,
    longitudinalIntelligenceAvailable:
      true,
    sourceLabel:
      "Hepatitis B Meltwater canonical corpus",
  },
  {
    therapeuticArea: "Gene Therapy",
    therapeuticAreaId:
      "gene_therapy",
    status: "validated",
    executiveIntelligenceAvailable:
      true,
    longitudinalIntelligenceAvailable:
      true,
    sourceLabel:
      "Gene Therapy curated canonical corpus",
  },
  {
    therapeuticArea:
      "Medical Aesthetics",
    therapeuticAreaId:
      "medical_aesthetics",
    status: "conversation_only",
    executiveIntelligenceAvailable:
      false,
    longitudinalIntelligenceAvailable:
      false,
    reason:
      "A validated finding-level canonical corpus has not yet been approved for this therapeutic area.",
  },
  {
    therapeuticArea:
      "Uterine Fibroids",
    therapeuticAreaId:
      "uterine_fibroids",
    status: "conversation_only",
    executiveIntelligenceAvailable:
      false,
    longitudinalIntelligenceAvailable:
      false,
    reason:
      "A validated finding-level canonical corpus has not yet been approved for this therapeutic area.",
  },
];

export function normalizeTherapeuticAreaId(
  value: string
): string {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases: Record<string, string> = {
    hep_b: "hepatitis_b",
    hepb: "hepatitis_b",
    hepatitisb: "hepatitis_b",
    regenerative_aesthetic:
      "regenerative_aesthetics",
    gene_therapies: "gene_therapy",
  };

  return aliases[normalized] || normalized;
}

export function getTherapeuticAreaCoverage(
  value: string
): TherapeuticAreaCoverage {
  const therapeuticAreaId =
    normalizeTherapeuticAreaId(value);
  const configured = COVERAGE.find(
    (item) =>
      item.therapeuticAreaId ===
      therapeuticAreaId
  );

  return configured || {
    therapeuticArea: value,
    therapeuticAreaId,
    status: "conversation_only",
    executiveIntelligenceAvailable:
      false,
    longitudinalIntelligenceAvailable:
      false,
    reason:
      "This therapeutic area is not present in the validated analytical coverage registry.",
  };
}

export function listTherapeuticAreaCoverage() {
  return COVERAGE.map((item) => ({
    ...item,
  }));
}
