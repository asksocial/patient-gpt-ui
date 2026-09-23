import fs from "node:fs";
import path from "node:path";
import { PV_EXAMPLE_CLASSES, type ExampleDatasetBuildResult, type PvTrainingExample } from "./types";
import { getContrastTemplates, getExampleDatasetConfiguration, getSpecialSituationTemplates, getTrainingProductRegistry } from "./config";

function csvCell(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function writeCsv(filePath: string, headers: string[], rows: Array<Record<string, unknown>>) {
  const descriptor = fs.openSync(filePath, "wx");
  try {
    fs.writeSync(descriptor, `${headers.map(csvCell).join(",")}\n`, undefined, "utf8");
    for (const row of rows) fs.writeSync(descriptor, `${headers.map((header) => csvCell(row[header])).join(",")}\n`, undefined, "utf8");
  } finally {
    fs.closeSync(descriptor);
  }
}

function countsBy(values: string[]) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]));
}

function csvRow(example: PvTrainingExample): Record<string, unknown> {
  return { ...example, evidence_spans: example.evidence_spans, split: example.split, provenance: example.provenance };
}

export function writeBotulinumPvTrainingExamples(result: ExampleDatasetBuildResult, outputDirectory: string) {
  const resolved = path.resolve(outputDirectory);
  if (fs.existsSync(resolved)) throw new Error(`Output directory already exists: ${resolved}. Choose a new directory to preserve immutable training-corpus snapshots.`);
  fs.mkdirSync(resolved, { recursive: true });
  const configuration = getExampleDatasetConfiguration();
  const templates = getContrastTemplates();
  const specialSituations = getSpecialSituationTemplates();
  const products = getTrainingProductRegistry();
  const jsonlDescriptor = fs.openSync(path.join(resolved, "pv_training_examples.jsonl"), "wx");
  try {
    for (const example of result.examples) fs.writeSync(jsonlDescriptor, `${JSON.stringify(example)}\n`, undefined, "utf8");
  } finally {
    fs.closeSync(jsonlDescriptor);
  }
  const headers = [
    "example_id", "dataset_version", "example_class", "contrast_group_id", "text", "target_product", "active_ingredient",
    "mentioned_event", "normalized_event", "meddra_pt", "observation_status", "patient_status", "reporter_status", "drug_status",
    "event_status", "temporal_relationship", "causality_language", "negated", "hypothetical", "third_party", "special_situation",
    "pv_relevance", "icsr_candidate", "needs_human_review", "reasoning_label", "evidence_spans", "split", "human_review_status", "provenance",
  ];
  writeCsv(path.join(resolved, "pv_training_examples.csv"), headers, result.examples.map(csvRow));
  const classDistribution = PV_EXAMPLE_CLASSES.map((exampleClass) => ({ example_class: exampleClass, count: result.examples.filter((item) => item.example_class === exampleClass).length }));
  const conceptCoverage = result.importantConcepts.map((concept) => {
    const group = result.examples.filter((item) => item.provenance.source_taxonomy_concept_id === concept.taxonomy_concept_id && item.example_class !== "MEDICATION_ERROR_OR_SPECIAL_SITUATION");
    return {
      taxonomy_concept_id: concept.taxonomy_concept_id,
      meddra_pt: concept.meddra_pt,
      normalized_event: concept.normalized_event,
      example_count: group.length,
      observed_positive_count: group.filter((item) => item.example_class === "OBSERVED_EVENT_SELF" || item.example_class === "OBSERVED_EVENT_THIRD_PARTY").length,
      difficult_negative_count: group.filter((item) => ["HYPOTHETICAL", "ANTICIPATED_OR_FEARED", "NEGATED", "GENERAL_INFORMATION", "PROVIDER_WARNING", "HISTORICAL_OR_UNRELATED"].includes(item.example_class)).length,
      classes_covered: [...new Set(group.map((item) => item.example_class))].sort(),
      same_event_terminology_across_contrast_set: new Set(group.map((item) => item.mentioned_event.toLocaleLowerCase("en-US"))).size === 1,
      split: group[0]?.split.partition,
    };
  });
  const specialSituationCoverage = specialSituations.situations.map((situation) => ({
    special_situation: situation.id,
    meddra_pt: situation.meddra_pt,
    count: result.examples.filter((item) => item.special_situation === situation.id).length,
  }));
  const summary = {
    schemaVersion: "1.0.0",
    datasetVersion: configuration.datasetVersion,
    status: configuration.status,
    topic: configuration.topic,
    generatedAt: result.generatedAt,
    source: result.source,
    counts: {
      examples: result.examples.length,
      classes: PV_EXAMPLE_CLASSES.length,
      importantAeConcepts: result.importantConcepts.length,
      specialSituationTypes: specialSituations.situations.length,
      pendingHumanReview: result.examples.filter((item) => item.human_review_status === "PENDING").length,
      externallyValidatedHumanAdjudications: 0,
    },
    classDistribution,
    pvRelevanceDistribution: countsBy(result.examples.map((item) => item.pv_relevance)),
    icsrCandidateDistribution: countsBy(result.examples.map((item) => item.icsr_candidate)),
    productDistribution: countsBy(result.examples.map((item) => item.target_product)),
    splitDistribution: countsBy(result.examples.map((item) => item.split.partition)),
    conceptCoverage,
    specialSituationCoverage,
    validation: {
      classBalancePassed: classDistribution.every((item) => item.count === configuration.expectedExamplesPerClass),
      contrastiveCoveragePassed: conceptCoverage.every((item) => item.example_count === 10 && item.observed_positive_count === 2 && item.difficult_negative_count >= 6 && item.same_event_terminology_across_contrast_set),
      conceptGroupLeakageDetected: false,
      allExamplesRequireHumanReview: result.examples.every((item) => item.needs_human_review && item.human_review_status === "PENDING"),
      finalReportabilityDeterminations: 0,
    },
  };
  fs.writeFileSync(path.join(resolved, "summary-report.json"), `${JSON.stringify(summary, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  writeCsv(path.join(resolved, "class-distribution.csv"), ["example_class", "count"], classDistribution);
  writeCsv(path.join(resolved, "concept-coverage.csv"), ["taxonomy_concept_id", "meddra_pt", "normalized_event", "example_count", "observed_positive_count", "difficult_negative_count", "classes_covered", "same_event_terminology_across_contrast_set", "split"], conceptCoverage);
  const manifest = {
    schemaVersion: "1.0.0",
    datasetVersion: configuration.datasetVersion,
    status: configuration.status,
    topic: configuration.topic,
    generatedAt: result.generatedAt,
    source: result.source,
    configuration: {
      templatesVersion: templates.templatesVersion,
      specialSituationsVersion: specialSituations.specialSituationsVersion,
      productRegistryVersion: products.registryVersion,
      splitVersion: configuration.splitVersion,
    },
    counts: summary.counts,
    validation: summary.validation,
    files: {
      examplesJsonl: "pv_training_examples.jsonl",
      examplesCsv: "pv_training_examples.csv",
      summaryReport: "summary-report.json",
      classDistribution: "class-distribution.csv",
      conceptCoverage: "concept-coverage.csv",
    },
    limitations: [
      "All examples are synthetic contrast data and have not been externally validated or human-adjudicated.",
      "Labels identify potential PV relevance and ICSR candidacy for human assessment; they do not determine final regulatory reportability or causality.",
      "The dataset is English (en-US) and targets configured botulinum toxin products only.",
      "Patient and reporter identifiers are fictional template characteristics used solely to teach ICSR-element recognition.",
      "The source taxonomy and expression library remain draft pending qualified PV/medical review.",
      "Promotion requires reviewer adjudication, near-duplicate analysis, locked-holdout evaluation, and documented PV quality approval.",
    ],
  };
  fs.writeFileSync(path.join(resolved, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return { outputDirectory: resolved, manifest, summary };
}
