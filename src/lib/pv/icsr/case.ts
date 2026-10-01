import { buildPvE2bAlignedCase } from "../e2b/case";
import { assessIcsrIdentifiability } from "../identifiability";
import { ASSESSMENT_FIELDS, CONCOMITANT_FIELDS, EVENT_FIELDS, HISTORY_FIELDS, PATIENT_FIELDS, PRODUCT_FIELDS, REPORTER_FIELDS, SERIOUSNESS_FIELDS } from "./types";
import type { Availability, CaseField, Fields, MinimumCriterion, R3AlignedCase, SeriousnessEvidence } from "./types";

export function emptyField(): CaseField {
  return { value: "", availability: "not_reported", evidence: "", confidence: null, source_reference: null, origin: "extracted", confirmed: false };
}
export function blankFields<K extends string>(keys: readonly K[]): Fields<K> {
  return Object.fromEntries(keys.map(key => [key, emptyField()])) as Fields<K>;
}
export function blankProduct() { return blankFields(PRODUCT_FIELDS); }
export function blankConcomitant() { return blankFields(CONCOMITANT_FIELDS); }
export function blankEvent(): R3AlignedCase["events"][number] {
  return { ...blankFields(EVENT_FIELDS), seriousness: Object.fromEntries(SERIOUSNESS_FIELDS.map(key => [key, { ...emptyField(), value: "evidence_absent_from_source", availability: "not_available_from_source" }])) as R3AlignedCase["events"][number]["seriousness"] };
}
export function displayField(field: CaseField | SeriousnessEvidence): string {
  const labels: Record<Availability, string> = { reported: field.value, not_reported: "Not reported", unknown: "Unknown (explicitly reported)", not_available_from_source: "Not available from source", requires_review: field.value ? `${field.value} (Requires review)` : "Requires review" };
  return labels[field.availability];
}

/** Only source-backed values are copied. A configured market is not patient country. */
export function buildR3AlignedCase(record: Record<string, any>): R3AlignedCase {
  const aligned = buildPvE2bAlignedCase({ record });
  const ontology = record.ae_ontology || {};
  const source = String(record.original_verbatim || "");
  const reference = `mention:${record.id}`;
  const field = (value: unknown, evidence: unknown, metadata = false): CaseField => {
    const text = String(value ?? "").trim();
    const quote = String(evidence ?? "").trim();
    if (!text || (!metadata && (!quote || !source.includes(quote)))) return emptyField();
    return { ...emptyField(), value: text, availability: /^(unknown|not known|don't know|do not know)$/i.test(text) ? "unknown" : "reported", evidence: quote, source_reference: reference, origin: metadata ? "source" : "extracted" };
  };
  // Optional clinical data are copied verbatim, rather than completing them from product knowledge.
  const clinicalField = (value: unknown, evidence: unknown): CaseField => {
    const text = String(value ?? "").trim();
    const quote = String(evidence ?? "").trim();
    return text && quote.toLowerCase().includes(text.toLowerCase()) ? field(text, quote) : emptyField();
  };
  const literal = (pattern: RegExp) => { const match = source.match(pattern); return match ? field(match[0], match[0]) : emptyField(); };
  const identifiability = assessIcsrIdentifiability(record);
  const criteria = ontology.icsrAssessment?.minimumCriteria || {};
  const criterion = (status: string, evidence: string): MinimumCriterion => ({
    present: status === "yes" && evidence ? "present" : status === "no" ? "not_identified" : "potentially_present",
    evidence, confidence: null, source_reference: evidence ? reference : null, confirmed: false,
  });
  // Existing identifiability rules remain authoritative; a handle alone awaits client PV review.
  const patientEvidence = identifiability.patient.evidence.join("; ");
  const reporterEvidence = String(record.author_identifier || "");
  const suspectProducts = aligned.drugs.filter(product => product.role !== "concomitant").map(product => {
    const result = blankProduct();
    result.brandName = field(product.productNameReported, product.sourceEvidence);
    const raw = (ontology.productProcedures || []).find((item: any) => item.value === product.productNameReported);
    result.brandName.confidence = result.brandName.value && typeof raw?.confidence === "number" && Number.isFinite(raw.confidence) ? Math.min(1, Math.max(0, raw.confidence)) : null;
    for (const key of PRODUCT_FIELDS.filter(key => key !== "brandName")) {
      result[key] = clinicalField(raw?.[key], raw?.fieldEvidence?.[key]);
    }
    return result;
  });
  const events = aligned.reactions.map((reaction, index) => {
    const result = blankEvent();
    const raw = ontology.adverseEvents?.[index];
    result.verbatim = field(raw?.evidence, raw?.evidence);
    result.normalizedEvent = field(raw?.value, raw?.evidence);
    const confidence = typeof raw?.confidence === "number" && Number.isFinite(raw.confidence) ? Math.min(1, Math.max(0, raw.confidence)) : null;
    result.verbatim.confidence = result.verbatim.value ? confidence : null;
    result.normalizedEvent.confidence = result.normalizedEvent.value ? confidence : null;
    for (const key of EVENT_FIELDS.filter(key => !["verbatim", "normalizedEvent", "meddraTerm", "meddraVersion"].includes(key))) {
      result[key] = clinicalField(raw?.[key], raw?.fieldEvidence?.[key]);
    }
    if (raw?.meddraValidated === true && raw?.meddraCode && raw?.meddraVersion && raw?.meddraReviewedBy) {
      result.meddraTerm = { ...field(raw.meddraTerm ? `${raw.meddraTerm} (${raw.meddraCode})` : raw.meddraCode, raw.evidence), confirmed: false };
      result.meddraVersion = field(raw.meddraVersion, raw.evidence);
    }
    // Do not distribute case-level outcome/onset/seriousness over multiple events.
    if (aligned.reactions.length === 1) {
      result.onset = field(ontology.timeToOnset?.value, ontology.timeToOnset?.evidence);
      const outcome = ontology.outcomes?.find((item: any) => item.category !== "hospitalization" && item.category !== "unknown");
      result.outcome = field(outcome?.value, outcome?.evidence);
      const seriousnessPatterns: Partial<Record<typeof SERIOUSNESS_FIELDS[number], RegExp>> = {
        hospitalization: /\b(?:ended up in (?:the )?hospital|was hospitali[sz]ed|admitted to (?:the )?hospital)\b/i,
        death: /\b(?:died|passed away)\b/i,
        lifeThreatening: /\b(?:life[- ]threatening)\b/i,
        disability: /\b(?:permanent disability|disabled|incapacitated)\b/i,
        congenitalAnomaly: /\b(?:birth defect|congenital anomaly)\b/i,
      };
      for (const key of SERIOUSNESS_FIELDS) {
        const match = seriousnessPatterns[key] ? source.match(seriousnessPatterns[key]!) : null;
        if (match) {
          const sentence = source.slice(Math.max(0, (match.index || 0) - 80), (match.index || 0) + match[0].length);
          const uncertain = /\b(?:not|never|if|would|could|might|heard|read)\b/i.test(sentence);
          const state = uncertain ? "requires_pv_review" : "evidence_present";
          result.seriousness[key] = { ...field(state, match[0]), value: state };
        }
      }
      if (ontology.seriousness?.evidence?.length && !Object.values(result.seriousness).some(item => item.value === "evidence_present")) {
        const quote = ontology.seriousness.evidence.find((item: string) => source.includes(item));
        if (quote) result.seriousness.otherMedicallyImportant = { ...field("requires_pv_review", quote), value: "requires_pv_review" };
      }
    } else {
      // Association with a particular event needs review; preserve evidence on the original source.
      const unassignedEvidence = (ontology.seriousness?.evidence || []).filter((quote: string) => source.includes(quote)).join("; ");
      for (const key of SERIOUSNESS_FIELDS) result.seriousness[key] = { ...emptyField(), value: "requires_pv_review", availability: "requires_review", evidence: unassignedEvidence, source_reference: unassignedEvidence ? reference : null };
    }
    return result;
  });
  const patient = blankFields(PATIENT_FIELDS);
  patient.age = literal(/\b(?:I am|I'm|patient is|patient was)\s+(?:a |an )?\d{1,3}(?:[- ](?:year|yr)s?[- ]old| years? old)\b/i);
  patient.ageGroup = literal(/\b(?:I am|I'm|patient is|patient was)\s+(?:a |an )?(?:adolescent|elderly|older adult)\b/i);
  patient.weight = literal(/\b(?:I weigh|patient weighs)\s+\d+(?:\.\d+)?\s*(?:kg|kilograms?|lbs?|pounds?)\b/i);
  patient.pregnancyStatus = literal(/\b(?:I am|I'm|patient is|patient was)\s+(?:not )?pregnant\b/i);
  patient.identifier = literal(/\bpatient (?:identifier|ID)\s*[:=]\s*[A-Za-z0-9_-]+\b/i);
  patient.sex = literal(/\b(?:I am|I'm|patient is|patient was)\s+(?:a |an )?(?:male|female|man|woman)\b/i);
  // Only patient-linked demographic phrasing is used; unrelated demographics remain unpopulated.
  if (identifiability.patient.association !== "specific_patient") {
    patient.age = emptyField(); patient.ageGroup = emptyField(); patient.sex = emptyField(); patient.weight = emptyField(); patient.pregnancyStatus = emptyField();
  }
  const reporter = blankFields(REPORTER_FIELDS);
  reporter.identifier = field(record.author_identifier, record.author_identifier, true);
  reporter.platform = field(record.source_type, record.source_type, true);
  const result: R3AlignedCase = {
    schemaVersion: "asksocial-r3-intake-1", id: String(record.id), status: "detected",
    identification: { reportType: { ...emptyField(), value: "Initial", availability: "requires_review" }, country: emptyField() },
    sourceEvidence: [{ id: reference, mentionId: String(record.id), url: String(record.source_url || ""), platform: String(record.source_type || ""), authorIdentifier: reporterEvidence, publicationTimestamp: String(record.posted_at || ""), detectionTimestamp: String(record.identified_at || ""), excerpt: source, evidenceHash: String(record.evidence_hash || "") }],
    minimumCriteria: {
      patient: criterion(identifiability.patient.criterionStatus, patientEvidence),
      reporter: criterion(identifiability.reporter.status === "verified" ? "yes" : reporterEvidence ? "unclear" : "no", reporterEvidence),
      product: criterion(suspectProducts.some(product => product.brandName.value) ? "yes" : criteria.suspectProduct?.status || "no", suspectProducts.map(product => product.brandName.evidence).filter(Boolean).join("; ")),
      event: criterion(events.some(event => event.verbatim.value) ? "yes" : criteria.adverseEventOrObservation?.status || "no", events.map(event => event.verbatim.evidence).filter(Boolean).join("; ")),
    },
    patient, reporter, suspectProducts, events,
    concomitantProducts: [], medicalHistory: blankFields(HISTORY_FIELDS),
    narrative: emptyField(), pvAssessment: Object.fromEntries(ASSESSMENT_FIELDS.map(key => [key, { ...emptyField(), availability: "requires_review" }])) as R3AlignedCase["pvAssessment"], internalNotes: "", approval: null,
  };
  for (const product of aligned.drugs.filter(product => product.role === "concomitant")) {
    result.concomitantProducts.push({ ...blankConcomitant(), product: field(product.productNameReported, product.sourceEvidence) });
  }
  result.narrative = { ...emptyField(), value: generateCaseNarrative(result), availability: "requires_review", evidence: source, source_reference: reference };
  return result;
}

export function importantMissingInformation(caseData: R3AlignedCase): string[] {
  const missing: string[] = [];
  for (const [section, fields] of [["Patient", caseData.patient], ["Reporter", caseData.reporter], ["Medical history", caseData.medicalHistory]] as const) {
    for (const [key, value] of Object.entries(fields)) if (value.availability !== "reported") missing.push(`${section} ${key}: ${displayField(value)}`);
  }
  caseData.suspectProducts.forEach((product, index) => PRODUCT_FIELDS.forEach(key => { if (product[key].availability !== "reported") missing.push(`Product ${index + 1} ${key}: ${displayField(product[key])}`); }));
  caseData.events.forEach((event, index) => {
    EVENT_FIELDS.filter(key => key !== "verbatim").forEach(key => { if (event[key].availability !== "reported") missing.push(`Event ${index + 1} ${key}: ${displayField(event[key])}`); });
    SERIOUSNESS_FIELDS.forEach(key => { if (event.seriousness[key].value !== "evidence_present") missing.push(`Event ${index + 1} ${key} evidence: ${event.seriousness[key].value.replaceAll("_", " ")}`); });
  });
  if (!caseData.concomitantProducts.length) missing.push("Concomitant products: Not reported");
  if (caseData.identification.country.availability !== "reported") missing.push(`Country: ${displayField(caseData.identification.country)}`);
  return missing;
}

/** Attribution to the source prevents reporter causality statements becoming platform conclusions. */
export function generateCaseNarrative(caseData: R3AlignedCase): string {
  const products = caseData.suspectProducts.map(product => displayField(product.brandName)).join("; ") || "Not reported";
  const events = caseData.events.map(event => `The source reported: “${displayField(event.verbatim)}”. Onset: ${displayField(event.onset)}. Outcome: ${displayField(event.outcome)}. Medical intervention: ${displayField(event.medicalIntervention)}.`).join(" ") || "An adverse event was not identified in the available source.";
  const indication = caseData.suspectProducts.map(product => displayField(product.indication)).join("; ") || "Not reported";
  return `Patient identifier: ${displayField(caseData.patient.identifier)}. Available patient age: ${displayField(caseData.patient.age)}. The source describes suspect product(s): ${products}. Indication: ${indication}. ${events} These statements reflect source evidence; causality has not been determined by AskSocial. Important missing information: ${["Dose", "exact administration date", "medical history", "concomitant products", "event treatment", "event outcome"].filter((_, index) => [caseData.suspectProducts.every(product => product.dose.availability !== "reported"), caseData.suspectProducts.every(product => product.therapyStartDate.availability !== "reported"), Object.values(caseData.medicalHistory).every(field => field.availability !== "reported"), !caseData.concomitantProducts.length, caseData.events.every(event => event.medicalIntervention.availability !== "reported"), caseData.events.every(event => event.outcome.availability !== "reported")][index]).join("; ") || "See reviewed case fields"}.`;
}

export function caseFields(caseData: R3AlignedCase): Array<[string, CaseField | SeriousnessEvidence]> {
  const result: Array<[string, CaseField | SeriousnessEvidence]> = [];
  for (const section of ["identification", "patient", "reporter", "medicalHistory", "pvAssessment"] as const) {
    for (const [key, field] of Object.entries(caseData[section])) result.push([`${section}.${key}`, field]);
  }
  for (const section of ["suspectProducts", "events", "concomitantProducts"] as const) {
    caseData[section].forEach((item, index) => Object.entries(item).forEach(([key, field]) => {
      if (key === "seriousness") Object.entries(field).forEach(([name, evidence]) => result.push([`${section}.${index}.seriousness.${name}`, evidence as SeriousnessEvidence]));
      else result.push([`${section}.${index}.${key}`, field as CaseField]);
    }));
  }
  result.push(["narrative", caseData.narrative]);
  return result;
}
