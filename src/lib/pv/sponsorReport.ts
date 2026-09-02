import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type SponsorCase = {
  id: string;
  record: Record<string, any>;
  review: Record<string, any>;
  transfer?: Record<string, any> | null;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

function printable(value: unknown, fallback = "Not reported - follow-up required") {
  const text = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value ?? "");
  const normalized = text.trim() || fallback;
  return normalized
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function timestamp(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? printable(value) : date.toISOString();
}

function display(value: unknown, fallback?: string) {
  return printable(value, fallback).replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = printable(text).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = words.shift() || "";
    for (const word of words) {
      const candidate = `${line} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function createPvSponsorReport(input: {
  cases: SponsorCase[];
  therapeuticArea?: string;
  generatedBy: string;
  generatedAt?: string;
  mode?: "sponsor_handoff" | "qa_not_relevant";
}) {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const qaMode = input.mode === "qa_not_relevant";
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cyan = rgb(0.12, 0.72, 0.82);
  const dark = rgb(0.08, 0.1, 0.12);
  const muted = rgb(0.34, 0.38, 0.42);
  const qaRed = rgb(0.72, 0.12, 0.14);
  let page: PDFPage;
  let y: number;

  function newPage(title?: string) {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText("ASKSOCIAL PV COMPLIANCE", { x: MARGIN, y, size: 9, font: bold, color: cyan });
    const runningHeader = qaMode ? "QA TEST - NOT FOR SPONSOR SUBMISSION" : "ICH E2D(R1) sponsor screening report";
    const runningHeaderFont = qaMode ? bold : regular;
    page.drawText(runningHeader, { x: PAGE_WIDTH - MARGIN - runningHeaderFont.widthOfTextAtSize(runningHeader, 8), y, size: 8, font: runningHeaderFont, color: qaMode ? qaRed : muted });
    y -= 24;
    if (title) {
      page.drawText(printable(title), { x: MARGIN, y, size: 16, font: bold, color: dark });
      y -= 24;
    }
  }

  function ensureSpace(height: number) {
    if (y - height < 54) newPage("Case continued");
  }

  function section(title: string) {
    ensureSpace(72);
    y -= 5;
    page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: 18, color: rgb(0.93, 0.97, 0.98) });
    page.drawText(printable(title).toUpperCase(), { x: MARGIN + 7, y, size: 9, font: bold, color: dark });
    y -= 23;
  }

  function field(label: string, value: unknown, options: { fallback?: string; size?: number } = {}) {
    const size = options.size || 9;
    const valueLines = wrapText(printable(value, options.fallback), regular, size, CONTENT_WIDTH - 155);
    const lineHeight = size + 3;
    let valueIndex = 0;
    let continued = false;
    while (valueIndex < valueLines.length) {
      const labelLines = wrapText(`${label}${continued ? " (continued)" : ""}:`, bold, size, 145);
      ensureSpace((Math.max(1, labelLines.length) * lineHeight) + 6);
      const availableLines = Math.max(1, Math.floor((y - 54 - 6) / lineHeight));
      const linesToDraw = Math.min(valueLines.length - valueIndex, availableLines);
      const valueChunk = valueLines.slice(valueIndex, valueIndex + linesToDraw);
      const lineCount = Math.max(labelLines.length, valueChunk.length);
      labelLines.forEach((line, index) => page.drawText(line, { x: MARGIN, y: y - (index * lineHeight), size, font: bold, color: dark }));
      valueChunk.forEach((line, index) => page.drawText(line, { x: MARGIN + 155, y: y - (index * lineHeight), size, font: regular, color: dark }));
      y -= (lineCount * lineHeight) + 6;
      valueIndex += linesToDraw;
      if (valueIndex < valueLines.length) {
        newPage("Case continued");
        continued = true;
      }
    }
  }

  function paragraph(value: unknown) {
    const lines = wrapText(printable(value), regular, 9, CONTENT_WIDTH);
    for (const line of lines) {
      ensureSpace(14);
      page.drawText(line, { x: MARGIN, y, size: 9, font: regular, color: dark });
      y -= 12;
    }
    y -= 5;
  }

  newPage();
  page.drawText(qaMode ? "QA Non-Reportable Export Test" : "Sponsor Safety Screening Report", { x: MARGIN, y, size: 23, font: bold, color: qaMode ? qaRed : dark });
  y -= 34;
  if (qaMode) {
    field("Document status", "QA TEST ONLY - NOT FOR SPONSOR SUBMISSION OR REGULATORY REPORTING");
    field("Included review decision", "Closed as Not Relevant");
  }
  field("Therapeutic area", input.therapeuticArea || "All permitted therapeutic areas", { fallback: "All permitted therapeutic areas" });
  field("Generated at", generatedAt);
  field("Generated by", input.generatedBy);
  field("Screened mentions", input.cases.length);
  field("Standard applied", qaMode ? "ICH E2D(R1) report-format QA only; included records did not meet the governed relevance decision" : "ICH E2D(R1), final Step 4 guideline adopted 15 September 2025");
  section("Regulatory-use notice");
  paragraph(qaMode
    ? "This document contains records that qualified reviewers closed as Not Relevant. It exists only to validate AskSocial export formatting and handoff mechanics. It must not be submitted to a sponsor as an ICSR package, used for regulatory reporting, or interpreted as evidence that reportability criteria were met. QA export and delivery do not start Day Zero or alter any record lifecycle status."
    : "This governed sponsor handoff supports pharmacovigilance intake and case assessment. It does not replace qualified medical review, regional or local reporting requirements, or required electronic ICSR transmission in ICH E2B format. Missing source information is shown explicitly and should be followed up where permissible and feasible.");
  section("Included assessments");
  paragraph(qaMode
    ? "Each QA example preserves its source verbatim, chronology, reviewer decision and rationale so reviewers can test pagination, field rendering, PDF integrity, email attachment delivery and audit provenance without treating the example as reportable safety content."
    : "Each case preserves the source verbatim and chronology; documents the four minimum ICSR criteria; records seriousness, expectedness, outcome, temporal association and causality language; retains clinical narrative and follow-up gaps; and records duplicate assessment, reviewer rationale, provenance and transfer status.");

  input.cases.forEach((item, index) => {
    const { record, review, transfer } = item;
    const ontology = review.validated_ae_ontology || {};
    const icsr = ontology.icsrAssessment || {};
    const minimum = icsr.minimumCriteria || {};
    const patientAssessment = icsr.patientAssessment || {};
    const reporterAssessment = icsr.reporterAssessment || {};
    const narrative = icsr.clinicalNarrative || {};
    const followUp = icsr.followUp || {};
    const duplicate = icsr.duplicateAssessment || {};
    const product = ontology.productProcedures?.[0]?.value || record.product_name;
    const event = ontology.adverseEvents?.[0]?.value || record.potential_event;
    const outcome = ontology.outcomes?.[0]?.category || ontology.outcomes?.[0]?.value;
    const causality = ontology.causality?.[0] || {};
    const criteriaStatuses = [
      minimum.suspectProduct?.status,
      minimum.adverseEventOrObservation?.status,
      minimum.identifiablePatient?.status,
      minimum.identifiableReporter?.status,
    ];
    const minimumCriteriaMet = criteriaStatuses.every((status) => status === "yes") ? "Yes" : "No - missing or unclear criteria require follow-up";

    newPage(`${qaMode ? "QA example" : "Case"} ${index + 1} of ${input.cases.length} - ${printable(product, "Unspecified product")}`);
    section("Case identification and source");
    field("AskSocial record ID", record.id);
    field(qaMode ? "Review ID" : "Escalation review ID", review.id);
    field("Therapeutic area", record.therapeutic_area);
    field("Lifecycle status", display(record.status));
    field("Review decision", display(review.decision));
    field("Report type", display(icsr.reportType, "Undetermined"));
    field("Primary source type", display(icsr.primarySourceType, "Unknown"));
    field("Evidence origin", record.import_batch_id ? "Social" : display(record.data_origin, "Unknown"));
    field("Source type", display(record.source_type));
    field("Source URL", record.source_url);
    field("Author / source identifier", record.author_identifier);
    field("Original language", record.original_language);

    section("Governed chronology");
    field("Publication timestamp", timestamp(record.posted_at));
    field("Collection timestamp", timestamp(record.ingested_at));
    field("Algorithm timestamp", timestamp(record.created_at || record.identified_at));
    field("Content availability timestamp", timestamp(record.identified_at));
    field("Structured-review start timestamp", timestamp(record.review_started_at));
    field("Reportability review / day-zero timestamp", timestamp(record.reportability_identified_at));
    field("Review decision timestamp", timestamp(review.reviewed_at));
    field("Escalation timestamp", qaMode ? "Not applicable - record closed as Not Relevant" : timestamp(review.reviewed_at));
    field("Sponsor transfer timestamp", timestamp(transfer?.transferred_at));

    section("ICH E2D(R1) minimum ICSR criteria");
    field("All four minimum criteria met", minimumCriteriaMet);
    field("Suspect or interacting product", `${display(minimum.suspectProduct?.status, "Unclear")} - ${printable(minimum.suspectProduct?.evidence || product)}`);
    field("AE/ADR or other observation", `${display(minimum.adverseEventOrObservation?.status, "Unclear")} - ${printable(minimum.adverseEventOrObservation?.evidence || event)}`);
    field("Identifiable patient", `${display(minimum.identifiablePatient?.status, "Unclear")} - ${printable(minimum.identifiablePatient?.evidence)}`);
    field("Patient association", display(patientAssessment.association, "Unclear"));
    field("Patient existence status", display(patientAssessment.existenceStatus, "Not established"));
    field("Patient qualifying characteristic types", patientAssessment.characteristicTypes);
    field("Patient qualifying characteristics", patientAssessment.qualifyingCharacteristics);
    field("Reviewer confirmed patient evidence", patientAssessment.reviewerConfirmed === true ? "Yes" : "No");
    field("Patient verification evidence", patientAssessment.verificationEvidence);
    field("Patient follow-up feasibility", display(patientAssessment.followUpFeasibility, "Unclear"));
    field("Patient follow-up status", display(patientAssessment.followUpStatus, "Not started"));
    field("Identifiable reporter", `${display(minimum.identifiableReporter?.status, "Unclear")} - ${printable(minimum.identifiableReporter?.evidence)}`);
    field("Reporter relationship to event", display(reporterAssessment.relationship, "Unclear"));
    field("Reporter existence status", display(reporterAssessment.existenceStatus, "Not established"));
    field("Reporter qualifying characteristics", reporterAssessment.qualifyingCharacteristics);
    field("Reporter verification evidence", reporterAssessment.verificationEvidence);
    field("Reporter follow-up feasibility", display(reporterAssessment.followUpFeasibility, "Unclear"));
    field("Reporter follow-up status", display(reporterAssessment.followUpStatus, "Not started"));

    section("Unfiltered primary-source evidence");
    paragraph(record.original_verbatim);
    field("Parent context", record.parent_context);
    field("Thread context", record.thread_context);
    field("Immutable evidence hash", record.evidence_hash);

    section("Reviewer-approved safety assessment");
    field("Product / procedure", product);
    field("Adverse event / observation", event);
    field("Classifications", review.classifications);
    field("Seriousness", display(ontology.seriousness?.value, "Unclear"));
    field("Seriousness criteria", icsr.seriousnessCriteria);
    field("Outcome", display(outcome, "Unknown"));
    field("Time to onset", `${display(ontology.timeToOnset?.category, "Unknown")} - ${printable(ontology.timeToOnset?.value, "No onset detail reported")}`);
    field("Severity", display(ontology.severity?.value, "Unclear"));
    field("Unexpectedness", display(ontology.unexpectedness?.value, "Unclear"));
    field("Expectedness basis", display(ontology.unexpectedness?.basis, "Insufficient reference"));
    field("Causality assessment", display(causality.value, "Not assessed"));
    field("Reporter causality language", causality.phrase);

    section("Stand-alone clinical narrative inputs");
    field("Patient characteristics", narrative.patientCharacteristics);
    field("Therapy details", narrative.therapyDetails);
    field("Medical history", narrative.medicalHistory);
    field("Concurrent conditions", narrative.concurrentConditions);
    field("Clinical course", narrative.clinicalCourse || record.original_verbatim);
    field("Diagnosis / laboratory evidence", narrative.diagnosisAndLaboratoryEvidence);
    field("Alternative causes / confounders", narrative.alternativeCausesAndConfounders);

    section("Case management and reporting assessment");
    field("Reviewer", review.reviewer_id);
    field("Reviewer rationale", review.rationale);
    field("Follow-up needed", display(followUp.needed, "Unclear"));
    field("Targeted follow-up questions", followUp.questions);
    field("Duplicate assessment", display(duplicate.status, "Not checked"));
    field("Duplicate reference", duplicate.reference);
    field("Regional / local reporting assessment", icsr.regionalReportingAssessment, { fallback: "Not assessed - sponsor must apply applicable regional and local requirements" });
    field("Ontology version", ontology.ontologyVersion || record.ontology_version);
    field("Classifier / library version", `${printable(record.classifier_version, "Unknown")} / ${printable(record.library_version, "Unknown")}`);
    field("Current transfer status", display(transfer?.status, "Not transferred"));
  });

  const pageCount = pdf.getPageCount();
  pdf.getPages().forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: PAGE_WIDTH - MARGIN, y: 38 }, thickness: 0.5, color: rgb(0.82, 0.84, 0.86) });
    currentPage.drawText(`${qaMode ? "QA TEST ONLY - NOT FOR SPONSOR SUBMISSION" : "Confidential PV working document"} | Page ${index + 1} of ${pageCount}`, { x: MARGIN, y: 24, size: 7, font: qaMode ? bold : regular, color: qaMode ? qaRed : muted });
  });
  const bytes = await pdf.save();
  return {
    bytes,
    hash: createHash("sha256").update(bytes).digest("hex"),
    generatedAt,
  };
}

export function sponsorReportFileName(therapeuticArea?: string, mode: "sponsor_handoff" | "qa_not_relevant" = "sponsor_handoff") {
  const scope = printable(therapeuticArea || "all-therapeutic-areas")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return mode === "qa_not_relevant"
    ? `asksocial-${scope || "pv"}-qa-not-relevant-export-test.pdf`
    : `asksocial-${scope || "pv"}-sponsor-screening-report.pdf`;
}
