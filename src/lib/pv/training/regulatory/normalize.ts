import { createHash } from "node:crypto";
import { getBotulinumProductRegistry, getBotulinumRegulatoryCorpusManifest, getOpenFdaRegulatoryMapping } from "./config";
import type {
  NormalizedFaersDate,
  NormalizedFaersDrug,
  NormalizedFaersOutcome,
  NormalizedFaersReaction,
  NormalizedFaersRegulatoryCase,
  OpenFdaQueryObservation,
  OpenFdaRawRecordEnvelope,
} from "./types";

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === null || value === undefined ? [] : [value];
}

function string(value: unknown): string | undefined {
  const result = String(value ?? "").trim();
  return result || undefined;
}

function strings(value: unknown): string[] {
  return array(value).map(string).filter(Boolean) as string[];
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function rawSha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizedProductValue(value: string) {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function sourceValueMatches(sourceValue: string, target: string) {
  const source = normalizedProductValue(sourceValue);
  const expected = normalizedProductValue(target);
  return source === expected || source.startsWith(`${expected} `) || source.includes(` ${expected} `) || source.endsWith(` ${expected}`);
}

export function normalizeOpenFdaDate(value: unknown): NormalizedFaersDate | undefined {
  const raw = string(value);
  if (!raw) return undefined;
  if (!/^\d{8}$/.test(raw)) return { raw };
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? { raw, iso: date.toISOString() } : { raw };
}

export function sourceProductValues(rawRecord: unknown) {
  const patient = object(object(rawRecord).patient);
  return unique(array(patient.drug).flatMap((value) => {
    const drug = object(value);
    const openfda = object(drug.openfda);
    return [
      string(drug.medicinalproduct),
      string(object(drug.activesubstance).activesubstancename),
      ...strings(openfda.brand_name),
      ...strings(openfda.generic_name),
      ...strings(openfda.substance_name),
    ];
  }));
}

export function sourceReactionValues(rawRecord: unknown) {
  return unique(array(object(object(rawRecord).patient).reaction).map((value) => string(object(value).reactionmeddrapt)));
}

function targetMatch(values: string[], targets: string[]) {
  return [...targets].sort((a, b) => b.length - a.length).find((target) => values.some((value) => sourceValueMatches(value, target)));
}

function normalizeDrug(rawDrug: unknown, sourceIndex: number): NormalizedFaersDrug {
  const drug = object(rawDrug);
  const openfda = object(drug.openfda);
  const registry = getBotulinumProductRegistry();
  const mapping = getOpenFdaRegulatoryMapping();
  const medicinalProduct = string(drug.medicinalproduct);
  const activeIngredient = string(object(drug.activesubstance).activesubstancename);
  const brandValues = unique([medicinalProduct, ...strings(openfda.brand_name)]);
  const activeIngredientValues = unique([
    activeIngredient,
    medicinalProduct,
    ...strings(openfda.generic_name),
    ...strings(openfda.substance_name),
  ]);
  const matchedTargetProduct = targetMatch(brandValues, registry.families.flatMap((family) => family.brands));
  const matchedActiveIngredient = targetMatch(activeIngredientValues, registry.families.flatMap((family) => family.activeIngredients));
  const roleCode = string(drug.drugcharacterization);
  const role = roleCode ? mapping.codes.drugRole[roleCode] || "unknown" : undefined;
  return {
    source_index: sourceIndex,
    medicinal_product: medicinalProduct,
    active_ingredient: activeIngredient,
    openfda_brand_names: strings(openfda.brand_name),
    openfda_generic_names: strings(openfda.generic_name),
    openfda_substance_names: strings(openfda.substance_name),
    drug_characterization_code: roleCode,
    drug_role: role,
    indication: string(drug.drugindication),
    dose_text: string(drug.drugdosagetext),
    structured_dose: string(drug.drugstructuredosagenumb) || string(drug.drugstructuredosageunit)
      ? { value: string(drug.drugstructuredosagenumb), unit_code: string(drug.drugstructuredosageunit) }
      : undefined,
    cumulative_dose: string(drug.drugcumulativedosagenumb) || string(drug.drugcumulativedosageunit)
      ? { value: string(drug.drugcumulativedosagenumb), unit_code: string(drug.drugcumulativedosageunit) }
      : undefined,
    route: string(drug.drugadministrationroute),
    therapy_start_date: normalizeOpenFdaDate(drug.drugstartdate),
    therapy_end_date: normalizeOpenFdaDate(drug.drugenddate),
    is_target_botulinum_product: Boolean(matchedTargetProduct || matchedActiveIngredient),
    matched_target_product: matchedTargetProduct,
    matched_active_ingredient: matchedActiveIngredient,
    suspect_role_if_available: matchedTargetProduct || matchedActiveIngredient ? role || "unknown" : undefined,
  };
}

function normalizeReactions(rawRecord: Record<string, any>) {
  const mapping = getOpenFdaRegulatoryMapping();
  const reactions: NormalizedFaersReaction[] = [];
  const outcomes: NormalizedFaersOutcome[] = [];
  array(object(rawRecord.patient).reaction).forEach((value, sourceIndex) => {
    const reaction = object(value);
    const preferredTerm = string(reaction.reactionmeddrapt);
    if (!preferredTerm) return;
    const outcomeCode = string(reaction.reactionoutcome);
    const outcome = outcomeCode ? mapping.codes.reactionOutcome[outcomeCode] : undefined;
    reactions.push({
      source_index: sourceIndex,
      source_reaction_value: preferredTerm,
      meddra_preferred_term: preferredTerm,
      meddra_version: string(reaction.reactionmeddraversionpt),
      outcome_code: outcomeCode,
      outcome,
    });
    if (outcomeCode) outcomes.push({
      source_reaction_index: sourceIndex,
      source_reaction_value: preferredTerm,
      outcome_code: outcomeCode,
      outcome: outcome || "unmapped",
    });
  });
  return { reactions, outcomes };
}

export function faersDeduplicationKey(rawRecord: unknown) {
  const raw = object(rawRecord);
  const safetyReportId = string(raw.safetyreportid);
  if (!safetyReportId) throw new Error("Malformed openFDA record: safetyreportid is required for identifier-based deduplication.");
  return `FDA_FAERS_OPENFDA:${safetyReportId}:v${string(raw.safetyreportversion) || "unknown"}`;
}

export function normalizeOpenFdaRegulatoryCase(
  rawRecord: unknown,
  observations: OpenFdaQueryObservation[],
): { raw: OpenFdaRawRecordEnvelope; normalized: NormalizedFaersRegulatoryCase } {
  const record = object(rawRecord);
  const deduplicationKey = faersDeduplicationKey(record);
  const safetyReportId = string(record.safetyreportid)!;
  const safetyReportVersion = string(record.safetyreportversion);
  const mapping = getOpenFdaRegulatoryMapping();
  const corpusManifest = getBotulinumRegulatoryCorpusManifest();
  const productRegistry = getBotulinumProductRegistry();
  const rawSourceRecordSha256 = rawSha256(record);
  const patient = object(record.patient);
  const primarySource = object(record.primarysource);
  const drugs = array(patient.drug).map(normalizeDrug);
  const { reactions, outcomes } = normalizeReactions(record);
  const warnings: string[] = [];
  if (!drugs.length) warnings.push("NO_DRUGS_REPORTED");
  if (!reactions.length) warnings.push("NO_REACTIONS_REPORTED");
  if (!string(record.receivedate)) warnings.push("RECEIVE_DATE_MISSING");
  if (!drugs.some((drug) => drug.is_target_botulinum_product)) warnings.push("QUERY_MATCH_NOT_CONFIRMED_ON_DRUG_OBJECT");
  for (const [field, value] of [["receipt_date", record.receiptdate], ["receive_date", record.receivedate], ["transmission_date", record.transmissiondate]] as const) {
    const parsed = normalizeOpenFdaDate(value);
    if (parsed?.raw && !parsed.iso) warnings.push(`${field.toUpperCase()}_MALFORMED`);
  }
  const ageUnitCode = string(patient.patientonsetageunit);
  const sexCode = string(patient.patientsex);
  const reporterQualificationCode = string(primarySource.qualification);
  const targetDrugs = drugs.filter((drug) => drug.is_target_botulinum_product);
  const normalized: NormalizedFaersRegulatoryCase = {
    case_id: deduplicationKey,
    faers_case_id: safetyReportId,
    safety_report_id: safetyReportId,
    safety_report_version: safetyReportVersion,
    authority_case_number: string(record.authoritynumb),
    company_case_number: string(record.companynumb),
    receipt_date: normalizeOpenFdaDate(record.receiptdate),
    receive_date: normalizeOpenFdaDate(record.receivedate),
    transmission_date: normalizeOpenFdaDate(record.transmissiondate),
    serious_indicator: string(record.serious) === "1" ? true : string(record.serious) === "2" ? false : undefined,
    seriousness_criteria: {
      death: string(record.seriousnessdeath) === "1",
      life_threatening: string(record.seriousnesslifethreatening) === "1",
      hospitalization: string(record.seriousnesshospitalization) === "1",
      disability: string(record.seriousnessdisabling) === "1",
      congenital_anomaly: string(record.seriousnesscongenitalanomali) === "1",
      other_medically_important: string(record.seriousnessother) === "1",
    },
    patient: string(patient.patientonsetage) || ageUnitCode || sexCode || string(patient.patientweight)
      ? {
        age: string(patient.patientonsetage),
        age_unit_code: ageUnitCode,
        age_unit: ageUnitCode ? mapping.codes.patientAgeUnit[ageUnitCode] : undefined,
        sex_code: sexCode,
        sex: sexCode ? mapping.codes.patientSex[sexCode] : undefined,
        weight_kg: string(patient.patientweight),
      }
      : undefined,
    country: string(record.occurcountry) || string(record.primarysourcecountry),
    reporter: reporterQualificationCode || string(primarySource.reportercountry) || string(record.primarysourcecountry)
      ? {
        qualification_code: reporterQualificationCode,
        qualification: reporterQualificationCode ? mapping.codes.reporterQualification[reporterQualificationCode] : undefined,
        country: string(primarySource.reportercountry) || string(record.primarysourcecountry),
      }
      : undefined,
    drugs,
    reactions,
    outcomes,
    concomitant_products: unique(drugs.filter((drug) => drug.drug_role === "concomitant").map((drug) => drug.medicinal_product)),
    is_target_botulinum_product: targetDrugs.length > 0,
    matched_target_products: unique(targetDrugs.map((drug) => drug.matched_target_product)),
    matched_active_ingredients: unique(targetDrugs.map((drug) => drug.matched_active_ingredient)),
    suspect_role_if_available: [...new Set(targetDrugs.map((drug) => drug.suspect_role_if_available).filter(Boolean))] as NormalizedFaersRegulatoryCase["suspect_role_if_available"],
    causality_status: "NOT_ESTABLISHED",
    provenance: {
      source: "FDA_FAERS_OPENFDA",
      endpoint: mapping.endpoint,
      source_api_queries: observations,
      raw_source_record_sha256: rawSourceRecordSha256,
      raw_source_record_storage: `raw-records.jsonl#${deduplicationKey}`,
      configuration_version: corpusManifest.configurationVersion,
      product_registry_version: productRegistry.registryVersion,
      source_mapping_version: mapping.mappingVersion,
    },
    normalization_warnings: warnings,
  };
  return {
    raw: { deduplicationKey, rawSourceRecordSha256, rawSourceRecord: record, observations },
    normalized,
  };
}
