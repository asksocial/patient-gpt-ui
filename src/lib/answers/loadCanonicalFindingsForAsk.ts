import fs from "fs";
import path from "path";
import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  ingestCurated,
  ingestMeltwaterCsv,
} from "../../ingestion";
import {
  getTherapeuticAreaCoverage,
  normalizeTherapeuticAreaId,
} from "../analytics/coverage";

export type AskAnalyticsSource =
  | "meltwater_csv"
  | "curated_findings";

export type CanonicalFindingsLoadResult =
  | {
      status: "available";
      therapeuticAreaId: string;
      source: AskAnalyticsSource;
      sourceLabel: string;
      findings: CanonicalFinding[];
    }
  | {
      status: "unavailable";
      therapeuticAreaId: string;
      reason: string;
      findings: [];
    };

type CorpusDefinition = {
  source: AskAnalyticsSource;
  sourceLabel: string;
  load: () => CanonicalFinding[];
};

const cachedCorpora = new Map<
  string,
  CanonicalFinding[]
>();

function requireFile(
  relativePath: string
): string {
  const filePath = path.resolve(
    process.cwd(),
    relativePath
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Canonical analytics corpus was not found at ${relativePath}`
    );
  }

  return filePath;
}

const CORPORA: Record<
  string,
  CorpusDefinition
> = {
  hepatitis_b: {
    source: "meltwater_csv",
    sourceLabel:
      "Hepatitis B Meltwater canonical corpus",
    load: () =>
      ingestMeltwaterCsv(
        requireFile(
          "data/HepB_-_Patients__Caregivers - Mar 11, 2026 - 11 47 15 AM.csv"
        ),
        {
          sourceType: "meltwater",
          therapeuticArea:
            "hepatitis_b",
          profileId: "hepatitis_b",
        }
      ) as CanonicalFinding[],
  },
  regenerative_aesthetics: {
    source: "meltwater_csv",
    sourceLabel:
      "Regenerative Aesthetics Meltwater canonical corpus",
    load: () =>
      ingestMeltwaterCsv(
        requireFile(
          "data/regen-aesthetics.csv"
        ),
        {
          sourceType: "meltwater",
          therapeuticArea:
            "regenerative_aesthetics",
          profileId:
            "regenerative_aesthetics",
        }
      ) as CanonicalFinding[],
  },
  medical_aesthetics: {
    source: "meltwater_csv",
    sourceLabel:
      "Medical Aesthetics approved shared Meltwater canonical corpus",
    load: () =>
      ingestMeltwaterCsv(
        requireFile(
          "data/regen-aesthetics.csv"
        ),
        {
          sourceType: "meltwater",
          therapeuticArea:
            "medical_aesthetics",
          profileId:
            "medical_aesthetics",
        }
      ) as CanonicalFinding[],
  },
  gene_therapy: {
    source: "curated_findings",
    sourceLabel:
      "Gene Therapy curated canonical corpus",
    load: () =>
      ingestCurated(
        "gene_therapy"
      ) as unknown as CanonicalFinding[],
  },
};

function cloneFindings(
  findings: CanonicalFinding[]
): CanonicalFinding[] {
  return structuredClone(findings);
}

export function loadCanonicalFindingsForAsk(
  therapeuticArea: string
): CanonicalFindingsLoadResult {
  const therapeuticAreaId =
    normalizeTherapeuticAreaId(
      therapeuticArea
    );
  const coverage =
    getTherapeuticAreaCoverage(
      therapeuticArea
    );

  if (coverage.status !== "validated") {
    return {
      status: "unavailable",
      therapeuticAreaId,
      reason:
        coverage.reason ||
        "Validated analytical coverage is unavailable.",
      findings: [],
    };
  }

  const corpus =
    CORPORA[therapeuticAreaId];

  if (!corpus) {
    return {
      status: "unavailable",
      therapeuticAreaId,
      reason:
        "No validated canonical finding corpus is configured for this therapeutic area.",
      findings: [],
    };
  }

  let findings =
    cachedCorpora.get(
      therapeuticAreaId
    );

  if (!findings) {
    try {
      findings = corpus.load();
    } catch (error) {
      console.error(
        "[loadCanonicalFindingsForAsk] failed to load corpus",
        {
          therapeuticAreaId,
          error,
        }
      );

      return {
        status: "unavailable",
        therapeuticAreaId,
        reason:
          "The configured canonical finding corpus could not be loaded.",
        findings: [],
      };
    }

    if (findings.length === 0) {
      return {
        status: "unavailable",
        therapeuticAreaId,
        reason:
          "The configured canonical finding corpus is empty.",
        findings: [],
      };
    }

    cachedCorpora.set(
      therapeuticAreaId,
      findings
    );
  }

  return {
    status: "available",
    therapeuticAreaId,
    source: corpus.source,
    sourceLabel:
      corpus.sourceLabel,
    findings:
      cloneFindings(findings),
  };
}
