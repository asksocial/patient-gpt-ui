import fs from "node:fs";
import path from "node:path";
import { getTaxonomyConfiguration, getTaxonomyRules } from "./config";
import type { AssociationSummaryRow, ReactionTaxonomyRecord, TaxonomyBuildResult } from "./types";

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

function taxonomyCsvRows(records: ReactionTaxonomyRecord[]) {
  return records.map((record) => ({
    concept_id: record.concept_id,
    taxonomy_version: record.taxonomy_version,
    meddra_pt: record.meddra_pt,
    normalized_label: record.normalized_label,
    normalized_concept: record.normalized_concept,
    concept_group_id: record.concept_group_id,
    relationship_status: record.relationship_status,
    related_concepts: record.related_concepts,
    semantic_category: record.semantic_category,
    semantic_categories: record.semantic_categories,
    category_system: record.category_system,
    category_is_official_meddra_hierarchy: record.category_is_official_meddra_hierarchy,
    source_reaction_occurrence_count: record.source_reaction_occurrence_count,
    source_case_count: record.source_case_count,
    source_report_count: record.source_report_count,
    associated_target_products: record.associated_target_products,
    associated_active_ingredients: record.associated_active_ingredients,
    serious_case_count: record.serious_case_count,
    nonserious_case_count: record.nonserious_case_count,
    unknown_seriousness_case_count: record.unknown_seriousness_case_count,
    first_seen_date: record.first_seen_date,
    last_seen_date: record.last_seen_date,
    example_case_ids: record.example_case_ids,
    frequency_rank: record.ranks.frequency,
    seriousness_rank: record.ranks.seriousness,
    product_breadth_rank: record.ranks.product_breadth,
    unique_cases_rank: record.ranks.unique_cases,
    review_status: record.review_status,
    provenance: record.provenance,
  }));
}

const taxonomyHeaders = [
  "concept_id", "taxonomy_version", "meddra_pt", "normalized_label", "normalized_concept", "concept_group_id",
  "relationship_status", "related_concepts", "semantic_category", "semantic_categories", "category_system",
  "category_is_official_meddra_hierarchy", "source_reaction_occurrence_count", "source_case_count", "source_report_count",
  "associated_target_products", "associated_active_ingredients", "serious_case_count", "nonserious_case_count",
  "unknown_seriousness_case_count", "first_seen_date", "last_seen_date", "example_case_ids", "frequency_rank",
  "seriousness_rank", "product_breadth_rank", "unique_cases_rank", "review_status", "provenance",
];

function compactSummary(record: ReactionTaxonomyRecord) {
  return {
    meddra_pt: record.meddra_pt,
    normalized_label: record.normalized_label,
    semantic_category: record.semantic_category,
    source_reaction_occurrence_count: record.source_reaction_occurrence_count,
    source_case_count: record.source_case_count,
    source_report_count: record.source_report_count,
    serious_case_count: record.serious_case_count,
    nonserious_case_count: record.nonserious_case_count,
    unknown_seriousness_case_count: record.unknown_seriousness_case_count,
    associated_target_products: record.associated_target_products,
    associated_active_ingredients: record.associated_active_ingredients,
    frequency_rank: record.ranks.frequency,
    seriousness_rank: record.ranks.seriousness,
    association_statement: record.provenance.association_statement,
  };
}

const compactHeaders = [
  "meddra_pt", "normalized_label", "semantic_category", "source_reaction_occurrence_count", "source_case_count",
  "source_report_count", "serious_case_count", "nonserious_case_count", "unknown_seriousness_case_count",
  "associated_target_products", "associated_active_ingredients", "frequency_rank", "seriousness_rank", "association_statement",
];

const associationHeaders = [
  "association_value", "meddra_pt", "normalized_label", "source_case_count", "serious_case_count",
  "nonserious_case_count", "unknown_seriousness_case_count", "association_statement",
];

export function writeBotulinumReactionTaxonomy(result: TaxonomyBuildResult, outputDirectory: string) {
  const resolved = path.resolve(outputDirectory);
  if (fs.existsSync(resolved)) throw new Error(`Output directory already exists: ${resolved}. Choose a new directory to preserve immutable taxonomy snapshots.`);
  fs.mkdirSync(path.join(resolved, "summaries"), { recursive: true });
  const configuration = getTaxonomyConfiguration();
  const rules = getTaxonomyRules();
  const reconciliation = {
    source_cases: result.source.casesRead,
    source_manifest_cases: result.source.expectedNormalizedRecords,
    cases_with_reaction_terminology: result.source.casesWithReactionTerminology,
    cases_missing_reaction_terminology: result.source.casesMissingReactionTerminology,
    case_reconciliation_passed: result.source.casesRead === result.source.casesWithReactionTerminology + result.source.casesMissingReactionTerminology,
    serious_cases: result.source.seriousCases,
    nonserious_cases: result.source.nonseriousCases,
    unknown_seriousness_cases: result.source.unknownSeriousnessCases,
    seriousness_reconciliation_passed: result.source.casesRead === result.source.seriousCases + result.source.nonseriousCases + result.source.unknownSeriousnessCases,
    valid_reaction_occurrences: result.source.validReactionOccurrences,
    taxonomy_reaction_occurrences: result.records.reduce((sum, record) => sum + record.source_reaction_occurrence_count, 0),
    reaction_reconciliation_passed: result.source.validReactionOccurrences === result.records.reduce((sum, record) => sum + record.source_reaction_occurrence_count, 0),
  };
  const taxonomyJson = {
    schemaVersion: "1.0.0",
    taxonomyVersion: configuration.taxonomyVersion,
    status: configuration.status,
    topic: configuration.topic,
    generatedAt: result.generatedAt,
    associationStatement: configuration.associationStatement,
    categorySystem: configuration.categorySystem,
    categorySystemIsOfficialMeddraHierarchy: false,
    normalizationPolicy: rules.normalizationPolicy,
    source: result.source,
    reconciliation,
    records: result.records,
  };
  fs.writeFileSync(path.join(resolved, "taxonomy.json"), `${JSON.stringify(taxonomyJson, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  writeCsv(path.join(resolved, "taxonomy.csv"), taxonomyHeaders, taxonomyCsvRows(result.records));

  const topOverall = result.summaries.topOverall.map(compactSummary);
  const topSerious = result.summaries.topSerious.map(compactSummary);
  const summaries: Array<[string, Array<Record<string, unknown>>, string[]]> = [
    ["top-50-reactions-overall", topOverall, compactHeaders],
    ["top-serious-reactions", topSerious, compactHeaders],
    ["reactions-by-product", result.summaries.byProduct as unknown as Array<Record<string, unknown>>, associationHeaders],
    ["reactions-by-active-ingredient", result.summaries.byActiveIngredient as unknown as Array<Record<string, unknown>>, associationHeaders],
    ["reactions-by-indication", result.summaries.byIndication as unknown as Array<Record<string, unknown>>, associationHeaders],
  ];
  for (const [name, rows, headers] of summaries) {
    fs.writeFileSync(path.join(resolved, "summaries", `${name}.json`), `${JSON.stringify(rows, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    writeCsv(path.join(resolved, "summaries", `${name}.csv`), headers, rows);
  }
  const outputManifest = {
    schemaVersion: "1.0.0",
    taxonomyVersion: configuration.taxonomyVersion,
    status: configuration.status,
    topic: configuration.topic,
    generatedAt: result.generatedAt,
    uniqueReactionPreferredTerms: result.records.length,
    source: result.source,
    reconciliation,
    configuration: {
      semanticRulesVersion: rules.rulesVersion,
      categorySystem: configuration.categorySystem,
      categorySystemIsOfficialMeddraHierarchy: false,
    },
    files: {
      taxonomyJson: "taxonomy.json",
      taxonomyCsv: "taxonomy.csv",
      topOverall: ["summaries/top-50-reactions-overall.json", "summaries/top-50-reactions-overall.csv"],
      topSerious: ["summaries/top-serious-reactions.json", "summaries/top-serious-reactions.csv"],
      byProduct: ["summaries/reactions-by-product.json", "summaries/reactions-by-product.csv"],
      byActiveIngredient: ["summaries/reactions-by-active-ingredient.json", "summaries/reactions-by-active-ingredient.csv"],
      byIndication: ["summaries/reactions-by-indication.json", "summaries/reactions-by-indication.csv"],
    },
    limitations: [
      "FAERS reports are spontaneous reports and cannot establish incidence or causality.",
      "Counts mean reported in association with cases containing a target product; they are not drug-to-reaction causal estimates.",
      "A case may contain multiple products, reactions, and indications without source-supported pairwise relationships.",
      "Internal semantic categories and relationship suggestions are not official MedDRA hierarchy and require PV review.",
      "openFDA generally exposes the latest report version; historical report amendments may require quarterly FAERS extracts.",
      "Missing reaction terminology remains counted as missing and is not imputed.",
    ],
  };
  fs.writeFileSync(path.join(resolved, "manifest.json"), `${JSON.stringify(outputManifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return { outputDirectory: resolved, manifest: outputManifest };
}
