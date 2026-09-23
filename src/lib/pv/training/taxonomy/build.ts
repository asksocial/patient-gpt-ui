import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { NormalizedFaersRegulatoryCase } from "../regulatory";
import { getTaxonomyConfiguration, getTaxonomyRules } from "./config";
import type {
  AssociationSummaryRow,
  PvSemanticCategory,
  ReactionTaxonomyRecord,
  TaxonomyBuildResult,
  TaxonomyRelationship,
} from "./types";

type ReactionAccumulator = {
  meddraPt: string;
  occurrenceCount: number;
  caseCount: number;
  reportIds: Set<string>;
  products: Set<string>;
  activeIngredients: Set<string>;
  seriousCaseCount: number;
  nonseriousCaseCount: number;
  unknownSeriousnessCaseCount: number;
  firstSeenDate?: string;
  lastSeenDate?: string;
  exampleCaseIds: string[];
  meddraVersions: Set<string>;
};

type AssociationAccumulator = {
  associationValue: string;
  meddraPt: string;
  normalizedLabel?: string;
  sourceCaseCount: number;
  seriousCaseCount: number;
  nonseriousCaseCount: number;
  unknownSeriousnessCaseCount: number;
};

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(prefix: string, value: string) {
  return `${prefix}_${sha256(value).slice(0, 20)}`;
}

function sourceDate(record: NormalizedFaersRegulatoryCase) {
  const configuration = getTaxonomyConfiguration();
  for (const field of configuration.datePrecedence) {
    const value = record[field];
    if (value?.iso) return value.iso.slice(0, 10);
    if (/^\d{8}$/.test(value?.raw || "")) return `${value!.raw.slice(0, 4)}-${value!.raw.slice(4, 6)}-${value!.raw.slice(6, 8)}`;
  }
  return undefined;
}

function normalizedLabel(meddraPt: string) {
  const explicit = getTaxonomyRules().explicitConceptMappings.find((mapping) => mapping.meddra_pts.includes(meddraPt));
  if (explicit) return explicit.normalized_concept;
  return meddraPt.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function semanticCategories(meddraPt: string, label: string): PvSemanticCategory[] {
  const searchValue = ` ${meddraPt.toLocaleLowerCase("en-US")} ${label.toLocaleLowerCase("en-US")} `;
  const matches = getTaxonomyRules().categories
    .filter((category) => category.patterns.some((pattern) => searchValue.includes(pattern.toLocaleLowerCase("en-US"))))
    .map((category) => category.id);
  return matches.length ? [...new Set(matches)] : ["other"];
}

function relationshipCandidates(
  meddraPt: string,
  availableTerms: Set<string>,
  normalizedGroups: Map<string, string[]>,
): TaxonomyRelationship[] {
  const mapping = getTaxonomyRules().explicitConceptMappings.find((candidate) => candidate.meddra_pts.includes(meddraPt));
  if (mapping) return mapping.meddra_pts
    .filter((candidate) => candidate !== meddraPt && availableTerms.has(candidate))
    .map((candidate) => ({
      meddra_pt: candidate,
      normalized_concept: mapping.normalized_concept,
      relationship_type: mapping.relationship_type,
      confidence: mapping.confidence,
      rationale: mapping.rationale,
      review_status: "algorithmic_candidate_pending_pv_review" as const,
    }));
  const label = normalizedLabel(meddraPt);
  return (normalizedGroups.get(label) || [])
    .filter((candidate) => candidate !== meddraPt)
    .map((candidate) => ({
      meddra_pt: candidate,
      normalized_concept: label,
      relationship_type: "equivalent_to" as const,
      confidence: 0.99,
      rationale: "Internal AskSocial duplicate candidate based only on case, Unicode presentation, punctuation, and whitespace normalization; both source MedDRA PT values remain unchanged.",
      review_status: "algorithmic_candidate_pending_pv_review" as const,
    }));
}

function updateDate(accumulator: ReactionAccumulator, date?: string) {
  if (!date) return;
  if (!accumulator.firstSeenDate || date < accumulator.firstSeenDate) accumulator.firstSeenDate = date;
  if (!accumulator.lastSeenDate || date > accumulator.lastSeenDate) accumulator.lastSeenDate = date;
}

function updateSeriousness(target: { seriousCaseCount: number; nonseriousCaseCount: number; unknownSeriousnessCaseCount: number }, serious?: boolean) {
  if (serious === true) target.seriousCaseCount += 1;
  else if (serious === false) target.nonseriousCaseCount += 1;
  else target.unknownSeriousnessCaseCount += 1;
}

function associationKey(value: string, meddraPt: string) {
  return `${value}\u0000${meddraPt}`;
}

function updateAssociation(
  map: Map<string, AssociationAccumulator>,
  associationValue: string,
  meddraPt: string,
  serious?: boolean,
) {
  const key = associationKey(associationValue, meddraPt);
  const current = map.get(key) || {
    associationValue,
    meddraPt,
    sourceCaseCount: 0,
    seriousCaseCount: 0,
    nonseriousCaseCount: 0,
    unknownSeriousnessCaseCount: 0,
  };
  current.sourceCaseCount += 1;
  updateSeriousness(current, serious);
  map.set(key, current);
}

function applyCompetitionRank(
  records: ReactionTaxonomyRecord[],
  rankField: keyof ReactionTaxonomyRecord["ranks"],
  metric: (record: ReactionTaxonomyRecord) => number,
) {
  const sorted = [...records].sort((a, b) => metric(b) - metric(a) || b.source_case_count - a.source_case_count || a.meddra_pt.localeCompare(b.meddra_pt));
  let previous: number | undefined;
  let rank = 0;
  sorted.forEach((record, index) => {
    const value = metric(record);
    if (previous === undefined || value !== previous) rank = index + 1;
    record.ranks[rankField] = rank;
    previous = value;
  });
}

function finalizeAssociations(
  values: Map<string, AssociationAccumulator>,
  labels: Map<string, string>,
  associationStatement: string,
): AssociationSummaryRow[] {
  return [...values.values()]
    .map((item) => ({
      association_value: item.associationValue,
      meddra_pt: item.meddraPt,
      normalized_label: labels.get(item.meddraPt) || normalizedLabel(item.meddraPt),
      source_case_count: item.sourceCaseCount,
      serious_case_count: item.seriousCaseCount,
      nonserious_case_count: item.nonseriousCaseCount,
      unknown_seriousness_case_count: item.unknownSeriousnessCaseCount,
      association_statement: associationStatement,
    }))
    .sort((a, b) => a.association_value.localeCompare(b.association_value) || b.source_case_count - a.source_case_count || a.meddra_pt.localeCompare(b.meddra_pt));
}

export async function buildBotulinumReactionTaxonomy(options: {
  sourceDirectory: string;
  now?: () => Date;
}): Promise<TaxonomyBuildResult> {
  const configuration = getTaxonomyConfiguration();
  const rules = getTaxonomyRules();
  const sourceDirectory = path.resolve(options.sourceDirectory);
  const normalizedRecordsPath = path.join(sourceDirectory, "normalized-records.jsonl");
  const manifestPath = path.join(sourceDirectory, "manifest.json");
  if (!fs.existsSync(normalizedRecordsPath)) throw new Error(`Normalized FAERS corpus not found: ${normalizedRecordsPath}`);
  if (!fs.existsSync(manifestPath)) throw new Error(`FAERS corpus manifest not found: ${manifestPath}`);
  const sourceManifestBytes = fs.readFileSync(manifestPath);
  const sourceManifest = JSON.parse(sourceManifestBytes.toString("utf8"));
  if (sourceManifest.status !== "complete" || sourceManifest.truncated) {
    throw new Error("Taxonomy generation requires a complete, untruncated regulatory corpus snapshot.");
  }

  const reactionAccumulators = new Map<string, ReactionAccumulator>();
  const productAssociations = new Map<string, AssociationAccumulator>();
  const ingredientAssociations = new Map<string, AssociationAccumulator>();
  const indicationAssociations = new Map<string, AssociationAccumulator>();
  const seenCaseIds = new Set<string>();
  const normalizedHash = createHash("sha256");
  let casesRead = 0;
  let duplicateCaseIds = 0;
  let casesWithReactionTerminology = 0;
  let casesMissingReactionTerminology = 0;
  let validReactionOccurrences = 0;
  let seriousCases = 0;
  let nonseriousCases = 0;
  let unknownSeriousnessCases = 0;

  const input = fs.createReadStream(normalizedRecordsPath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    normalizedHash.update(`${line}\n`);
    let record: NormalizedFaersRegulatoryCase;
    try {
      record = JSON.parse(line) as NormalizedFaersRegulatoryCase;
    } catch (error) {
      throw new Error(`Malformed normalized FAERS JSON at line ${lineNumber}: ${error instanceof Error ? error.message : error}`);
    }
    casesRead += 1;
    if (!record.case_id || !record.safety_report_id) throw new Error(`Normalized FAERS record at line ${lineNumber} is missing a case or report identifier.`);
    if (seenCaseIds.has(record.case_id)) {
      duplicateCaseIds += 1;
      throw new Error(`Duplicate normalized FAERS case ID ${record.case_id} at line ${lineNumber}; taxonomy generation stopped rather than silently discarding it.`);
    }
    seenCaseIds.add(record.case_id);
    if (record.serious_indicator === true) seriousCases += 1;
    else if (record.serious_indicator === false) nonseriousCases += 1;
    else unknownSeriousnessCases += 1;

    const reactionsThisCase = new Map<string, { occurrences: number; versions: Set<string> }>();
    for (const reaction of Array.isArray(record.reactions) ? record.reactions : []) {
      const meddraPt = typeof reaction.meddra_preferred_term === "string" ? reaction.meddra_preferred_term : "";
      if (!meddraPt.trim()) continue;
      validReactionOccurrences += 1;
      const item = reactionsThisCase.get(meddraPt) || { occurrences: 0, versions: new Set<string>() };
      item.occurrences += 1;
      if (reaction.meddra_version) item.versions.add(reaction.meddra_version);
      reactionsThisCase.set(meddraPt, item);
    }
    if (!reactionsThisCase.size) {
      casesMissingReactionTerminology += 1;
      continue;
    }
    casesWithReactionTerminology += 1;
    const date = sourceDate(record);
    const targetDrugs = (Array.isArray(record.drugs) ? record.drugs : []).filter((drug) => drug.is_target_botulinum_product);
    const products = [...new Set((record.matched_target_products || []).filter(Boolean))];
    const ingredients = [...new Set((record.matched_active_ingredients || []).filter(Boolean))];
    const indications = [...new Set(targetDrugs.map((drug) => drug.indication).filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];

    for (const [meddraPt, caseReaction] of reactionsThisCase) {
      const accumulator = reactionAccumulators.get(meddraPt) || {
        meddraPt,
        occurrenceCount: 0,
        caseCount: 0,
        reportIds: new Set<string>(),
        products: new Set<string>(),
        activeIngredients: new Set<string>(),
        seriousCaseCount: 0,
        nonseriousCaseCount: 0,
        unknownSeriousnessCaseCount: 0,
        exampleCaseIds: [],
        meddraVersions: new Set<string>(),
      };
      accumulator.occurrenceCount += caseReaction.occurrences;
      accumulator.caseCount += 1;
      accumulator.reportIds.add(record.safety_report_id);
      products.forEach((value) => accumulator.products.add(value));
      ingredients.forEach((value) => accumulator.activeIngredients.add(value));
      caseReaction.versions.forEach((value) => accumulator.meddraVersions.add(value));
      updateSeriousness(accumulator, record.serious_indicator);
      updateDate(accumulator, date);
      if (accumulator.exampleCaseIds.length < configuration.exampleCaseLimit) accumulator.exampleCaseIds.push(record.case_id);
      reactionAccumulators.set(meddraPt, accumulator);
      products.forEach((value) => updateAssociation(productAssociations, value, meddraPt, record.serious_indicator));
      ingredients.forEach((value) => updateAssociation(ingredientAssociations, value, meddraPt, record.serious_indicator));
      indications.forEach((value) => updateAssociation(indicationAssociations, value, meddraPt, record.serious_indicator));
    }
  }

  const expectedNormalizedRecords = Number(sourceManifest.recordCounts?.normalized);
  if (Number.isFinite(expectedNormalizedRecords) && casesRead !== expectedNormalizedRecords) {
    throw new Error(`Source reconciliation failed: read ${casesRead} cases but the source manifest declares ${expectedNormalizedRecords}.`);
  }
  if (casesRead !== casesWithReactionTerminology + casesMissingReactionTerminology) {
    throw new Error("Source reconciliation failed: cases with and without reaction terminology do not sum to cases read.");
  }

  const generatedAt = (options.now || (() => new Date()))().toISOString();
  const normalizedRecordsSha256 = normalizedHash.digest("hex");
  const manifestSha256 = sha256(sourceManifestBytes);
  const availableTerms = new Set(reactionAccumulators.keys());
  const normalizedGroups = new Map<string, string[]>();
  for (const meddraPt of availableTerms) {
    const label = normalizedLabel(meddraPt);
    normalizedGroups.set(label, [...(normalizedGroups.get(label) || []), meddraPt]);
  }
  const records = [...reactionAccumulators.values()].map((item): ReactionTaxonomyRecord => {
    const label = normalizedLabel(item.meddraPt);
    const categories = semanticCategories(item.meddraPt, label);
    const related = relationshipCandidates(item.meddraPt, availableTerms, normalizedGroups);
    return {
      concept_id: stableId("faers_pt", item.meddraPt),
      taxonomy_version: configuration.taxonomyVersion,
      meddra_pt: item.meddraPt,
      normalized_label: label,
      normalized_concept: label,
      concept_group_id: stableId("asksocial_concept", label),
      relationship_status: related.length ? "algorithmic_candidate_pending_pv_review" : "no_relationship_suggested",
      related_concepts: related,
      semantic_category: categories[0],
      semantic_categories: categories,
      category_system: configuration.categorySystem,
      category_is_official_meddra_hierarchy: false,
      source_reaction_occurrence_count: item.occurrenceCount,
      source_case_count: item.caseCount,
      source_report_count: item.reportIds.size,
      associated_target_products: [...item.products].sort(),
      associated_active_ingredients: [...item.activeIngredients].sort(),
      serious_case_count: item.seriousCaseCount,
      nonserious_case_count: item.nonseriousCaseCount,
      unknown_seriousness_case_count: item.unknownSeriousnessCaseCount,
      first_seen_date: item.firstSeenDate,
      last_seen_date: item.lastSeenDate,
      example_case_ids: item.exampleCaseIds,
      ranks: { frequency: 0, seriousness: 0, product_breadth: 0, unique_cases: 0 },
      review_status: "draft_pending_pv_review",
      provenance: {
        source: "FDA_FAERS_OPENFDA_NORMALIZED_CORPUS",
        source_corpus_snapshot: path.basename(sourceDirectory),
        source_normalized_records: normalizedRecordsPath,
        source_manifest_sha256: manifestSha256,
        source_normalized_records_sha256: normalizedRecordsSha256,
        source_configuration_version: String(sourceManifest.configurationVersion || "unknown"),
        source_product_registry_version: String(sourceManifest.productRegistryVersion || "unknown"),
        source_mapping_version: String(sourceManifest.sourceMappingVersion || "unknown"),
        taxonomy_rules_version: rules.rulesVersion,
        source_meddra_versions: [...item.meddraVersions].sort(),
        generated_at: generatedAt,
        association_statement: configuration.associationStatement,
      },
    };
  });
  applyCompetitionRank(records, "frequency", (record) => record.source_reaction_occurrence_count);
  applyCompetitionRank(records, "seriousness", (record) => record.serious_case_count);
  applyCompetitionRank(records, "product_breadth", (record) => record.associated_target_products.length);
  applyCompetitionRank(records, "unique_cases", (record) => record.source_case_count);
  records.sort((a, b) => a.ranks.frequency - b.ranks.frequency || a.meddra_pt.localeCompare(b.meddra_pt));
  const labels = new Map(records.map((record) => [record.meddra_pt, record.normalized_label]));

  return {
    generatedAt,
    source: {
      snapshotDirectory: sourceDirectory,
      normalizedRecordsPath,
      manifestPath,
      normalizedRecordsSha256,
      manifestSha256,
      expectedNormalizedRecords: Number.isFinite(expectedNormalizedRecords) ? expectedNormalizedRecords : undefined,
      casesRead,
      duplicateCaseIds,
      casesWithReactionTerminology,
      casesMissingReactionTerminology,
      validReactionOccurrences,
      seriousCases,
      nonseriousCases,
      unknownSeriousnessCases,
    },
    records,
    summaries: {
      topOverall: [...records].sort((a, b) => a.ranks.frequency - b.ranks.frequency || a.meddra_pt.localeCompare(b.meddra_pt)).slice(0, configuration.summaryLimit),
      topSerious: [...records].sort((a, b) => a.ranks.seriousness - b.ranks.seriousness || a.ranks.unique_cases - b.ranks.unique_cases || a.meddra_pt.localeCompare(b.meddra_pt)).slice(0, configuration.summaryLimit),
      byProduct: finalizeAssociations(productAssociations, labels, configuration.associationStatement),
      byActiveIngredient: finalizeAssociations(ingredientAssociations, labels, configuration.associationStatement),
      byIndication: finalizeAssociations(indicationAssociations, labels, configuration.associationStatement),
    },
  };
}
