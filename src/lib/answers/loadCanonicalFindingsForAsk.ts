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
import type { TherapeuticAreaCoverage } from "../analytics/coverage";

export type AskAnalyticsSource =
  | "meltwater_csv"
  | "curated_findings";

export type CanonicalFindingsLoadResult =
  | {
      status: "available";
      therapeuticAreaId: string;
      source: AskAnalyticsSource;
      sourceLabel: string;
      relevancePolicy: "standard" | "prequalified";
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
  relevancePolicy?: "standard" | "prequalified";
  load: () => CanonicalFinding[];
};

const cachedCorpora = new Map<
  string,
  CanonicalFinding[]
>();

export function getCanonicalCorpusFileCandidates(
  therapeuticAreaId: string,
  moduleId?: string
) {
  const areaNames = Array.from(new Set([
    therapeuticAreaId,
    therapeuticAreaId.replace(/_/g, "-"),
  ]));
  const moduleNames = moduleId
    ? Array.from(new Set([moduleId, moduleId.replace(/_/g, "-")]))
    : [];

  return moduleId
    ? areaNames.flatMap((area) =>
        moduleNames.map((module) => `data/${area}-${module}.csv`)
      )
    : areaNames.map((area) => `data/${area}.csv`);
}

function discoverMeltwaterCorpus(
  therapeuticArea: string,
  therapeuticAreaId: string,
  moduleId?: string
): CorpusDefinition | undefined {
  const relativePath = getCanonicalCorpusFileCandidates(therapeuticAreaId, moduleId)
    .find((candidate) => fs.existsSync(path.resolve(process.cwd(), candidate)));

  if (!relativePath) return undefined;

  const moduleLabel = moduleId
    ? ` ${moduleId.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}`
    : "";

  return {
    source: "meltwater_csv",
    sourceLabel: `${therapeuticArea}${moduleLabel} Meltwater canonical corpus`,
    load: () =>
      ingestMeltwaterCsv(requireFile(relativePath), {
        sourceType: "meltwater",
        therapeuticArea,
        profileId: therapeuticAreaId,
        includeCurated: moduleId ? false : undefined,
      }) as CanonicalFinding[],
  };
}

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
    load: () => [
      ...ingestCurated("hepatitis_b"),
      ...ingestCurated("hepatitis_b_part1"),
      ...ingestMeltwaterCsv(
        requireFile(
          "data/HepB_-_Patients__Caregivers - Mar 11, 2026 - 11 47 15 AM.csv"
        ),
        {
          sourceType: "meltwater",
          therapeuticArea:
            "hepatitis_b",
          profileId: "hepatitis_b",
          includeCurated: false,
        }
      ),
    ] as unknown as CanonicalFinding[],
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
  botulinum_toxin: {
    source: "meltwater_csv",
    sourceLabel: "Botulinum toxin Meltwater canonical corpus",
    load: () =>
      ingestMeltwaterCsv(
        requireFile("data/botulinum-toxin.csv"),
        {
          sourceType: "meltwater",
          therapeuticArea: "botulinum_toxin",
          profileId: "botulinum_toxin",
        }
      ) as CanonicalFinding[],
  },
  gene_therapy: {
    source: "curated_findings",
    sourceLabel:
      "Gene Therapy curated and social canonical corpus",
    load: () => [
      ...ingestCurated("gene_therapy"),
      ...ingestCurated("gene_therapy_social"),
    ] as unknown as CanonicalFinding[],
  },
};

const MODULE_CORPORA: Record<
  string,
  Record<string, CorpusDefinition>
> = {
  botulinum_toxin: {
    clinical_trials: {
      source: "meltwater_csv",
      sourceLabel: "Botulinum toxin Clinical Trials Meltwater corpus",
      relevancePolicy: "prequalified",
      load: () =>
        ingestMeltwaterCsv(
          requireFile("data/botulinum-toxin-clinical-trials.csv"),
          {
            sourceType: "meltwater",
            therapeuticArea: "botulinum_toxin",
            profileId: "botulinum_toxin",
            relevancePolicy: "prequalified",
            includeCurated: false,
          }
        ) as CanonicalFinding[],
    },
  },
};

function resolveCoreCorpus(therapeuticArea: string) {
  const therapeuticAreaId = normalizeTherapeuticAreaId(therapeuticArea);
  return {
    therapeuticAreaId,
    corpus:
      CORPORA[therapeuticAreaId] ||
      discoverMeltwaterCorpus(therapeuticArea, therapeuticAreaId),
  };
}

export function getCanonicalCorpusAvailability(therapeuticArea: string) {
  const { therapeuticAreaId, corpus } = resolveCoreCorpus(therapeuticArea);
  return {
    therapeuticAreaId,
    available: Boolean(corpus),
    source: corpus?.source || null,
    sourceLabel: corpus?.sourceLabel || null,
    relevancePolicy: corpus?.relevancePolicy || "standard",
  };
}

export function getEffectiveTherapeuticAreaCoverage(
  therapeuticArea: string
): TherapeuticAreaCoverage {
  const configured = getTherapeuticAreaCoverage(therapeuticArea);
  const corpus = getCanonicalCorpusAvailability(therapeuticArea);
  if (!corpus.available) return configured;

  return {
    ...configured,
    therapeuticArea,
    therapeuticAreaId: corpus.therapeuticAreaId,
    status: "validated",
    executiveIntelligenceAvailable: true,
    longitudinalIntelligenceAvailable: true,
    sourceLabel: corpus.sourceLabel || configured.sourceLabel,
    reason: undefined,
  };
}

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
  const coverage = getEffectiveTherapeuticAreaCoverage(therapeuticArea);
  const { corpus } = resolveCoreCorpus(therapeuticArea);

  if (!corpus && coverage.status !== "validated") {
    return {
      status: "unavailable",
      therapeuticAreaId,
      reason:
        coverage.reason ||
        "Validated analytical coverage is unavailable.",
      findings: [],
    };
  }

  if (!corpus) {
    return {
      status: "unavailable",
      therapeuticAreaId,
      reason:
        "No validated canonical finding corpus is configured for this topic.",
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
    relevancePolicy: corpus.relevancePolicy || "standard",
    findings:
      cloneFindings(findings),
  };
}

export function loadCanonicalFindingsForModule(
  therapeuticArea: string,
  moduleId: string
): CanonicalFindingsLoadResult {
  const therapeuticAreaId = normalizeTherapeuticAreaId(therapeuticArea);
  const moduleCorpus =
    MODULE_CORPORA[therapeuticAreaId]?.[moduleId] ||
    discoverMeltwaterCorpus(
      therapeuticArea,
      therapeuticAreaId,
      moduleId
    );

  if (!moduleCorpus) {
    return loadCanonicalFindingsForAsk(therapeuticArea);
  }

  const cacheKey = `${therapeuticAreaId}:module:${moduleId}`;
  let findings = cachedCorpora.get(cacheKey);

  if (!findings) {
    try {
      findings = moduleCorpus.load();
    } catch (error) {
      console.error("[loadCanonicalFindingsForModule] failed to load corpus", {
        therapeuticAreaId,
        moduleId,
        error,
      });
      return {
        status: "unavailable",
        therapeuticAreaId,
        reason: "The configured module-specific finding corpus could not be loaded.",
        findings: [],
      };
    }

    if (findings.length === 0) {
      return {
        status: "unavailable",
        therapeuticAreaId,
        reason: "The configured module-specific finding corpus is empty.",
        findings: [],
      };
    }

    cachedCorpora.set(cacheKey, findings);
  }

  return {
    status: "available",
    therapeuticAreaId,
    source: moduleCorpus.source,
    sourceLabel: moduleCorpus.sourceLabel,
    relevancePolicy: moduleCorpus.relevancePolicy || "standard",
    findings: cloneFindings(findings),
  };
}
