import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getCuratedExpressionSeeds, getExpressionLibraryConfiguration, getExpressionTemplates } from "./config";
import {
  EXPRESSION_FIELDS,
  type ExpressionConfidence,
  type ExpressionField,
  type ExpressionLibraryBuildResult,
  type ExpressionQualityControlRecord,
  type GenerationProfile,
  type SocialExpression,
  type SocialExpressionConceptRecord,
} from "./types";
import type { ReactionTaxonomyRecord } from "../taxonomy";

type TaxonomyArtifact = {
  taxonomyVersion?: string;
  status?: string;
  records?: ReactionTaxonomyRecord[];
};

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeExpression(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
}

function includesPattern(value: string, patterns: string[]) {
  const normalized = normalizeExpression(value);
  return patterns.some((pattern) => normalized.includes(normalizeExpression(pattern)));
}

function priorityFor(record: ReactionTaxonomyRecord) {
  const configuration = getExpressionLibraryConfiguration();
  return record.ranks.frequency <= configuration.highPriorityDefinition.frequencyRankAtOrBelow
    || record.ranks.seriousness <= configuration.highPriorityDefinition.seriousnessRankAtOrBelow
    ? "high" as const
    : "standard" as const;
}

function profileFor(record: ReactionTaxonomyRecord, priority: "high" | "standard"): GenerationProfile {
  const configuration = getExpressionLibraryConfiguration();
  const searchable = `${record.meddra_pt} ${record.normalized_concept}`;
  if (includesPattern(searchable, configuration.fatalOutcomePatterns)) return priority === "high" ? "fatal_outcome_high_priority" : "manual_review_only";
  if (includesPattern(searchable, configuration.nonClinicalPatterns)) return priority === "high" ? "special_situation_high_priority" : "manual_review_only";
  if (priority === "high") return "clinical_high_priority";
  return record.semantic_category === "other" ? "manual_review_only" : "clinical_standard";
}

function generatedConfidence(field: ExpressionField): ExpressionConfidence {
  if (["colloquial_expressions", "slang_or_informal_phrasing", "causal_expressions", "uncertain_causality_expressions"].includes(field)) return "low";
  return "medium";
}

function createExpression(options: {
  expression: string;
  field: ExpressionField;
  source: "GENERATED" | "CURATED";
  confidence: ExpressionConfidence;
  record: ReactionTaxonomyRecord;
  taxonomyPath: string;
  taxonomySha256: string;
  taxonomyVersion: string;
  generatedAt: string;
  sourceReference: string;
}): SocialExpression {
  const configuration = getExpressionLibraryConfiguration();
  const templates = getExpressionTemplates();
  const seeds = getCuratedExpressionSeeds();
  const expression = options.expression.replace(/\s+/g, " ").trim();
  const normalized = normalizeExpression(expression);
  return {
    expression_id: `expr_${sha256(`${options.record.concept_id}|${options.field}|${options.source}|${normalized}`).slice(0, 24)}`,
    expression,
    normalized_expression: normalized,
    expression_type: options.field,
    expression_source: options.source,
    confidence: options.confidence,
    language: configuration.language,
    locale: configuration.locale,
    taxonomy_concept_id: options.record.concept_id,
    normalized_concept: options.record.normalized_concept,
    meddra_pt: options.record.meddra_pt,
    is_official_meddra_synonym: false,
    validation_status: "pending_pv_medical_review",
    provenance: {
      source_reference: options.sourceReference,
      source_taxonomy_snapshot: path.basename(path.dirname(options.taxonomyPath)),
      source_taxonomy_sha256: options.taxonomySha256,
      taxonomy_version: options.taxonomyVersion,
      templates_version: templates.templatesVersion,
      curated_seeds_version: seeds.seedsVersion,
      generated_at: options.generatedAt,
      generation_method: options.source === "CURATED" ? "versioned_curated_seed" : "versioned_template",
      association_statement: configuration.associationStatement,
      official_terminology_statement: configuration.officialTerminologyStatement,
    },
  };
}

function qualityControlRecord(concept: SocialExpressionConceptRecord): ExpressionQualityControlRecord {
  const expressions = EXPRESSION_FIELDS.flatMap((field) => concept[field]);
  const reasons = ["All expressions require qualified PV/medical review before production activation."];
  if (concept.priority === "high") reasons.push("High-priority source concept requires explicit coverage and mapping review.");
  if (concept.generation_profile === "special_situation_high_priority") reasons.push("Special-situation language must not be treated as a clinical symptom or causality conclusion.");
  if (concept.generation_profile === "fatal_outcome_high_priority") reasons.push("Fatal-outcome language requires critical medical and safety review.");
  if (concept.generation_profile === "manual_review_only") reasons.push("Automated expansion was withheld because the concept is rare, ambiguous, or unsafe to paraphrase without domain review.");
  if (concept.semantic_category === "other") reasons.push("Internal semantic category is unresolved ('other').");
  if (expressions.some((item) => item.confidence === "low")) reasons.push("Low-confidence colloquial or causal-context candidates are present.");
  return {
    taxonomy_concept_id: concept.taxonomy_concept_id,
    meddra_pt: concept.meddra_pt,
    canonical_concept: concept.canonical_concept,
    priority: concept.generation_profile === "fatal_outcome_high_priority" ? "critical" : concept.priority,
    generation_profile: concept.generation_profile,
    expression_count: expressions.length,
    generated_expression_count: expressions.filter((item) => item.expression_source === "GENERATED").length,
    curated_expression_count: expressions.filter((item) => item.expression_source === "CURATED").length,
    low_confidence_expression_count: expressions.filter((item) => item.confidence === "low").length,
    reasons,
    required_action: "Confirm semantic fidelity, remove unsafe over-expansion, approve or revise each mapping, and record reviewer identity and decision in the governed promotion workflow.",
    production_eligible: false,
  };
}

function validateTaxonomy(records: ReactionTaxonomyRecord[]) {
  if (!records.length) throw new Error("The source taxonomy contains no concepts.");
  const ids = new Set<string>();
  const preferredTerms = new Set<string>();
  for (const record of records) {
    if (!record.concept_id || !record.meddra_pt?.trim() || !record.normalized_concept?.trim()) throw new Error("Every taxonomy record must have a concept ID, MedDRA PT, and normalized concept.");
    if (ids.has(record.concept_id)) throw new Error(`Duplicate taxonomy concept ID: ${record.concept_id}`);
    if (preferredTerms.has(record.meddra_pt)) throw new Error(`Duplicate source MedDRA PT: ${record.meddra_pt}`);
    ids.add(record.concept_id);
    preferredTerms.add(record.meddra_pt);
  }
}

export function validateExpressionLibrary(result: ExpressionLibraryBuildResult) {
  const configuration = getExpressionLibraryConfiguration();
  if (result.concepts.length !== result.source.taxonomyConceptCount) throw new Error("Expression concept count does not reconcile to the source taxonomy.");
  const expressionIds = new Set<string>();
  for (const expression of result.expressions) {
    if (!expression.expression_id || !expression.expression || !expression.taxonomy_concept_id || !expression.normalized_concept || !expression.meddra_pt || !expression.provenance?.source_reference) {
      throw new Error(`Expression is missing its parent mapping or provenance: ${expression.expression_id || "unknown"}`);
    }
    if (expression.is_official_meddra_synonym !== false) throw new Error(`Expression incorrectly claims official MedDRA synonym status: ${expression.expression_id}`);
    if (expressionIds.has(expression.expression_id)) throw new Error(`Duplicate expression ID: ${expression.expression_id}`);
    expressionIds.add(expression.expression_id);
  }
  for (const concept of result.concepts.filter((item) => item.priority === "high")) {
    for (const [field, minimum] of Object.entries(configuration.minimumHighPriorityCoverage)) {
      if (concept[field as keyof typeof configuration.minimumHighPriorityCoverage].length < minimum) {
        throw new Error(`High-priority concept ${concept.meddra_pt} has fewer than ${minimum} ${field}.`);
      }
    }
  }
  if (result.qualityControl.length !== result.concepts.length || result.qualityControl.some((item) => item.production_eligible !== false)) {
    throw new Error("Every draft concept must be represented in the non-production quality-control report.");
  }
}

export function buildBotulinumSocialExpressionLibrary(options: { taxonomyPath: string; now?: () => Date }): ExpressionLibraryBuildResult {
  const taxonomyPath = path.resolve(options.taxonomyPath);
  const sourceBytes = fs.readFileSync(taxonomyPath);
  let artifact: TaxonomyArtifact;
  try {
    artifact = JSON.parse(sourceBytes.toString("utf8")) as TaxonomyArtifact;
  } catch (error) {
    throw new Error(`Malformed source taxonomy JSON at ${taxonomyPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const records = artifact.records || [];
  validateTaxonomy(records);
  const configuration = getExpressionLibraryConfiguration();
  const templates = getExpressionTemplates();
  const curatedSeeds = getCuratedExpressionSeeds();
  const taxonomyVersion = artifact.taxonomyVersion || records[0]?.taxonomy_version;
  if (!taxonomyVersion) throw new Error("Source taxonomy version is missing.");
  const sourcePreferredTerms = new Set(records.map((record) => record.meddra_pt));
  for (const seed of curatedSeeds.concepts) {
    if (!sourcePreferredTerms.has(seed.meddra_pt)) throw new Error(`Curated expression seed has no source taxonomy parent: ${seed.meddra_pt}`);
  }
  const taxonomySha256 = sha256(sourceBytes);
  const generatedAt = (options.now || (() => new Date()))().toISOString();
  const seedByPreferredTerm = new Map(curatedSeeds.concepts.map((seed) => [seed.meddra_pt, seed]));

  const concepts = records.map((record): SocialExpressionConceptRecord => {
    const priority = priorityFor(record);
    const generationProfile = profileFor(record, priority);
    const buckets = Object.fromEntries(EXPRESSION_FIELDS.map((field) => [field, []])) as Record<ExpressionField, SocialExpression[]>;
    const seen = new Set<string>();
    const add = (field: ExpressionField, phrase: string, source: "GENERATED" | "CURATED", confidence: ExpressionConfidence, reference: string) => {
      const expanded = phrase.replaceAll("{concept}", record.normalized_concept).trim();
      if (!expanded) return;
      const key = `${field}|${normalizeExpression(expanded)}`;
      if (seen.has(key)) return;
      seen.add(key);
      buckets[field].push(createExpression({ expression: expanded, field, source, confidence, record, taxonomyPath, taxonomySha256, taxonomyVersion, generatedAt, sourceReference: reference }));
    };
    const seed = seedByPreferredTerm.get(record.meddra_pt);
    if (seed) {
      for (const field of EXPRESSION_FIELDS) for (const phrase of seed[field] || []) add(field, phrase, "CURATED", seed.confidence, `${curatedSeeds.seedsVersion}:${record.meddra_pt}:${field}`);
    }
    const profile = templates.profiles[generationProfile];
    for (const field of EXPRESSION_FIELDS) for (const phrase of profile[field] || []) add(field, phrase, "GENERATED", generatedConfidence(field), `${templates.templatesVersion}:${generationProfile}:${field}`);
    return {
      taxonomy_concept_id: record.concept_id,
      meddra_pt: record.meddra_pt,
      canonical_concept: record.normalized_concept,
      taxonomy_version: taxonomyVersion,
      library_version: configuration.libraryVersion,
      semantic_category: record.semantic_category,
      priority,
      generation_profile: generationProfile,
      source_case_count: record.source_case_count,
      review_status: "pending_pv_medical_review",
      ...buckets,
      provenance: {
        source_taxonomy_concept_id: record.concept_id,
        source_taxonomy_snapshot: path.basename(path.dirname(taxonomyPath)),
        source_taxonomy_sha256: taxonomySha256,
        source_meddra_pt_preserved: true,
        generated_at: generatedAt,
      },
    };
  });
  const expressions = concepts.flatMap((concept) => EXPRESSION_FIELDS.flatMap((field) => concept[field]));
  const result: ExpressionLibraryBuildResult = {
    generatedAt,
    source: {
      taxonomyPath,
      taxonomySnapshot: path.basename(path.dirname(taxonomyPath)),
      taxonomySha256,
      taxonomyVersion,
      taxonomyConceptCount: records.length,
    },
    concepts,
    expressions,
    qualityControl: concepts.map(qualityControlRecord),
    sourceTaxonomyRecords: records,
  };
  validateExpressionLibrary(result);
  return result;
}
