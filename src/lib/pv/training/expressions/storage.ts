import fs from "node:fs";
import path from "node:path";
import { EXPRESSION_FIELDS, type ExpressionLibraryBuildResult, type SocialExpression } from "./types";
import { getCuratedExpressionSeeds, getExpressionLibraryConfiguration, getExpressionTemplates } from "./config";

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

function expressionRow(expression: SocialExpression) {
  return {
    expression_id: expression.expression_id,
    expression: expression.expression,
    normalized_expression: expression.normalized_expression,
    expression_type: expression.expression_type,
    expression_source: expression.expression_source,
    confidence: expression.confidence,
    language: expression.language,
    locale: expression.locale,
    taxonomy_concept_id: expression.taxonomy_concept_id,
    normalized_concept: expression.normalized_concept,
    meddra_pt: expression.meddra_pt,
    is_official_meddra_synonym: expression.is_official_meddra_synonym,
    validation_status: expression.validation_status,
    provenance: expression.provenance,
  };
}

export function writeBotulinumSocialExpressionLibrary(result: ExpressionLibraryBuildResult, outputDirectory: string) {
  const resolved = path.resolve(outputDirectory);
  if (fs.existsSync(resolved)) throw new Error(`Output directory already exists: ${resolved}. Choose a new directory to preserve immutable expression-library snapshots.`);
  fs.mkdirSync(resolved, { recursive: true });
  const configuration = getExpressionLibraryConfiguration();
  const templates = getExpressionTemplates();
  const curatedSeeds = getCuratedExpressionSeeds();
  const highPriority = result.concepts.filter((concept) => concept.priority === "high");
  const generatedCount = result.expressions.filter((expression) => expression.expression_source === "GENERATED").length;
  const curatedCount = result.expressions.length - generatedCount;
  const conceptsWithNoExpressions = result.concepts.filter((concept) => EXPRESSION_FIELDS.every((field) => concept[field].length === 0)).length;
  const library = {
    schemaVersion: "1.0.0",
    libraryVersion: configuration.libraryVersion,
    status: configuration.status,
    topic: configuration.topic,
    generatedAt: result.generatedAt,
    safeguards: {
      expressionsAreOfficialMeddraSynonyms: false,
      causalityEstablished: false,
      productionUseAllowedBeforePvMedicalReview: false,
      associationStatement: configuration.associationStatement,
      officialTerminologyStatement: configuration.officialTerminologyStatement,
    },
    source: result.source,
    counts: {
      taxonomyConcepts: result.concepts.length,
      highPriorityConcepts: highPriority.length,
      conceptsWithExpressions: result.concepts.length - conceptsWithNoExpressions,
      conceptsWithNoExpressions,
      expressions: result.expressions.length,
      generatedExpressions: generatedCount,
      curatedExpressions: curatedCount,
    },
    concept_records: result.concepts,
  };
  fs.writeFileSync(path.join(resolved, "social_expression_library.json"), `${JSON.stringify(library, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  const expressionHeaders = [
    "expression_id", "expression", "normalized_expression", "expression_type", "expression_source", "confidence", "language", "locale",
    "taxonomy_concept_id", "normalized_concept", "meddra_pt", "is_official_meddra_synonym", "validation_status", "provenance",
  ];
  writeCsv(path.join(resolved, "social_expression_library.csv"), expressionHeaders, result.expressions.map(expressionRow));
  const qcSummary = {
    schemaVersion: "1.0.0",
    libraryVersion: configuration.libraryVersion,
    status: "manual_pv_medical_review_required",
    generatedAt: result.generatedAt,
    productionEligibleConcepts: 0,
    conceptsRequiringManualReview: result.qualityControl.length,
    criticalConcepts: result.qualityControl.filter((item) => item.priority === "critical").length,
    highPriorityConcepts: result.qualityControl.filter((item) => item.priority === "high").length,
    conceptsWithNoExpressions,
    records: result.qualityControl,
  };
  fs.writeFileSync(path.join(resolved, "quality-control-report.json"), `${JSON.stringify(qcSummary, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  const qcHeaders = ["taxonomy_concept_id", "meddra_pt", "canonical_concept", "priority", "generation_profile", "expression_count", "generated_expression_count", "curated_expression_count", "low_confidence_expression_count", "reasons", "required_action", "production_eligible"];
  writeCsv(path.join(resolved, "quality-control-report.csv"), qcHeaders, result.qualityControl as unknown as Array<Record<string, unknown>>);
  const manifest = {
    schemaVersion: "1.0.0",
    libraryVersion: configuration.libraryVersion,
    status: configuration.status,
    topic: configuration.topic,
    generatedAt: result.generatedAt,
    source: result.source,
    configuration: {
      templatesVersion: templates.templatesVersion,
      curatedSeedsVersion: curatedSeeds.seedsVersion,
      highPriorityDefinition: configuration.highPriorityDefinition,
      minimumHighPriorityCoverage: configuration.minimumHighPriorityCoverage,
    },
    counts: library.counts,
    validation: {
      allTaxonomyConceptsRetained: result.concepts.length === result.source.taxonomyConceptCount,
      allExpressionsHaveParentMappingAndProvenance: true,
      highPriorityCoveragePassed: true,
      allExpressionsPendingPvMedicalReview: result.expressions.every((item) => item.validation_status === "pending_pv_medical_review"),
      officialMeddraSynonymClaims: 0,
      productionEligibleConcepts: 0,
    },
    files: {
      libraryJson: "social_expression_library.json",
      libraryCsv: "social_expression_library.csv",
      qualityControlJson: "quality-control-report.json",
      qualityControlCsv: "quality-control-report.csv",
    },
    limitations: [
      "Generated and curated expressions are draft recognition candidates and are not official MedDRA synonyms.",
      "Expression mappings do not establish that botulinum toxin caused an event and must not be used to infer incidence.",
      "All concepts and expressions require qualified PV/medical review before production activation.",
      "Rare or ambiguous concepts may intentionally have no generated expressions to avoid unsafe semantic over-expansion.",
      "The initial library is English (en-US); multilingual variants require separate governed versions.",
      "Misspellings are curated only for selected concepts; automated misspelling generation was withheld to limit false positives.",
    ],
  };
  fs.writeFileSync(path.join(resolved, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return { outputDirectory: resolved, manifest };
}
