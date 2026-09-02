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
    const words = paragraph.split(/\s+/).filter(Boolean).flatMap((word) => {
      if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
      const segments: string[] = [];
      let segment = "";
      for (const character of word) {
        const candidate = `${segment}${character}`;
        if (segment && font.widthOfTextAtSize(candidate, size) > maxWidth) {
          segments.push(segment);
          segment = character;
        } else segment = candidate;
      }
      if (segment) segments.push(segment);
      return segments;
    });
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

function compactTimestamp(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return printable(value);
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)} UTC`;
}

function compactDate(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? printable(value) : date.toISOString().slice(0, 10);
}

function sourceDomain(value: unknown) {
  try {
    return new URL(String(value || "")).hostname.replace(/^www\./, "") || "Unknown";
  } catch {
    return "Unknown";
  }
}

function clippedLines(text: unknown, font: PDFFont, size: number, width: number, maximum: number) {
  const lines = wrapText(printable(text), font, size, width);
  if (lines.length <= maximum) return lines;
  const visible = lines.slice(0, maximum);
  let last = visible[visible.length - 1] || "";
  while (last && font.widthOfTextAtSize(`${last}...`, size) > width) last = last.slice(0, -1);
  visible[visible.length - 1] = `${last}...`;
  return visible;
}

async function createQaCaseSheetReport(input: {
  cases: SponsorCase[];
  therapeuticArea?: string;
  generatedBy: string;
  generatedAt: string;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.08, 0.08, 0.09);
  const muted = rgb(0.38, 0.38, 0.4);
  const rule = rgb(0.82, 0.81, 0.81);
  const pale = rgb(0.94, 0.93, 0.93);
  const qaRed = rgb(0.91, 0.14, 0.06);
  const margin = 32;
  const width = PAGE_WIDTH - (margin * 2);
  const footerLabels: string[] = [];

  function drawLines(page: PDFPage, lines: string[], x: number, y: number, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; leading?: number } = {}) {
    const font = options.font || regular;
    const size = options.size || 7;
    const color = options.color || ink;
    const leading = options.leading || size + 2;
    lines.forEach((line, index) => page.drawText(line, { x, y: y - (index * leading), size, font, color }));
    return y - (lines.length * leading);
  }

  function smallCaps(page: PDFPage, text: string, x: number, y: number, color = muted, size = 6.2) {
    page.drawText(printable(text).toUpperCase(), { x, y, size, font: regular, color });
  }

  function row(page: PDFPage, x: number, y: number, rowWidth: number, label: string, value: unknown, options: { labelWidth?: number; maxLines?: number; valueFont?: PDFFont; valueColor?: ReturnType<typeof rgb>; minimumHeight?: number; valueSize?: number } = {}) {
    const labelWidth = options.labelWidth ?? Math.min(82, rowWidth * 0.42);
    const valueSize = options.valueSize || 6.8;
    const lines = clippedLines(value, options.valueFont || regular, valueSize, rowWidth - labelWidth - 4, options.maxLines || 2);
    const height = Math.max(options.minimumHeight || 13.5, (lines.length * 7.7) + 5);
    page.drawLine({ start: { x, y: y - height + 1 }, end: { x: x + rowWidth, y: y - height + 1 }, thickness: 0.35, color: rule });
    smallCaps(page, label, x, y - 8, muted, 5.2);
    drawLines(page, lines, x + labelWidth, y - 8, { font: options.valueFont || regular, size: valueSize, color: options.valueColor || ink, leading: 7.7 });
    return y - height;
  }

  function stackedRow(page: PDFPage, x: number, y: number, rowWidth: number, label: string, value: unknown) {
    const lines = clippedLines(value, regular, 5.4, rowWidth, 2);
    const height = Math.max(15.5, 10 + (lines.length * 6.4));
    smallCaps(page, label, x, y - 5, muted, 4.6);
    drawLines(page, lines, x, y - 12, { size: 5.4, leading: 6.4 });
    page.drawLine({ start: { x, y: y - height + 1 }, end: { x: x + rowWidth, y: y - height + 1 }, thickness: 0.3, color: rule });
    return y - height;
  }

  function sectionTitle(page: PDFPage, title: string, x: number, y: number, sectionWidth: number) {
    smallCaps(page, title, x, y, qaRed, 6.3);
    page.drawLine({ start: { x, y: y - 7 }, end: { x: x + sectionWidth, y: y - 7 }, thickness: 0.45, color: rule });
    return y - 12;
  }

  function statusValue(status: unknown, evidence: unknown, fallback: unknown) {
    return `${display(status, "Unclear")} - ${printable(evidence || fallback)}`;
  }

  const cover = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  smallCaps(cover, "AskSocial PV Compliance", margin, 748, ink, 6.7);
  smallCaps(cover, "QA Non-Reportable Export Test", margin, 737, ink, 6.7);
  const badge = "QA TEST ONLY - NOT FOR SPONSOR SUBMISSION";
  const badgeWidth = bold.widthOfTextAtSize(badge, 6.4) + 18;
  cover.drawRectangle({ x: PAGE_WIDTH - margin - badgeWidth, y: 733, width: badgeWidth, height: 20, color: qaRed });
  cover.drawText(badge, { x: PAGE_WIDTH - margin - badgeWidth + 9, y: 740, size: 6.4, font: bold, color: rgb(1, 1, 1) });
  cover.drawLine({ start: { x: margin, y: 721 }, end: { x: PAGE_WIDTH - margin, y: 721 }, thickness: 1.6, color: ink });
  const area = printable(input.therapeuticArea || "All permitted therapeutic areas", "All permitted therapeutic areas");
  cover.drawText(area, { x: margin, y: 682, size: 28, font: bold, color: ink });
  cover.drawText("QA case sheets", { x: margin, y: 648, size: 28, font: bold, color: ink });
  drawLines(cover, clippedLines(`${input.cases.length} screened mention${input.cases.length === 1 ? "" : "s"} closed as Not Relevant, each reformatted onto a single sheet. Every record preserves its source verbatim, chronology, reviewer decision and rationale.`, regular, 8.2, width, 3), margin, 614, { size: 8.2, leading: 12 });

  const statY = 570;
  const statWidth = width / 4;
  const stats = [
    ["Screened mentions", String(input.cases.length)],
    ["Review decision", "Closed as Not Relevant"],
    ["Standard applied", "ICH E2D(R1) format QA"],
    ["Generated", compactTimestamp(input.generatedAt)],
  ];
  cover.drawLine({ start: { x: margin, y: statY + 10 }, end: { x: PAGE_WIDTH - margin, y: statY + 10 }, thickness: 1, color: ink });
  stats.forEach(([label, value], index) => {
    const x = margin + (index * statWidth);
    if (index) cover.drawLine({ start: { x, y: statY + 10 }, end: { x, y: statY - 28 }, thickness: 0.5, color: rule });
    smallCaps(cover, label, x + (index ? 8 : 0), statY - 3, muted, 5.4);
    drawLines(cover, clippedLines(value, bold, 7.8, statWidth - 12, 2), x + (index ? 8 : 0), statY - 18, { font: bold, size: 7.8, leading: 9 });
  });
  cover.drawLine({ start: { x: margin, y: statY - 28 }, end: { x: PAGE_WIDTH - margin, y: statY - 28 }, thickness: 0.7, color: rule });

  smallCaps(cover, "Regulatory-use notice", margin, 522, qaRed, 5.7);
  cover.drawLine({ start: { x: 130, y: 532 }, end: { x: 130, y: 487 }, thickness: 0.6, color: rule });
  drawLines(cover, clippedLines("This document contains records that qualified reviewers closed as Not Relevant. It exists only to validate AskSocial export formatting and handoff mechanics. It must not be submitted to a sponsor as an ICSR package, used for regulatory reporting, or interpreted as evidence that reportability criteria were met. QA export and delivery do not start Day Zero or alter any record lifecycle status.", regular, 6.7, PAGE_WIDTH - margin - 142, 5), 138, 523, { size: 6.7, leading: 8.5 });
  cover.drawLine({ start: { x: margin, y: 482 }, end: { x: PAGE_WIDTH - margin, y: 482 }, thickness: 1.5, color: ink });
  smallCaps(cover, "Index of included assessments", margin, 463, muted, 6);
  const indexWidths = [24, 250, 110, 88, 76];
  const indexLabels = ["Ex.", "Adverse event / observation", "Author / source", "Source", "Published"];
  let indexX = margin;
  indexLabels.forEach((label, index) => { smallCaps(cover, label, indexX, 443, muted, 5.2); indexX += indexWidths[index]; });
  cover.drawLine({ start: { x: margin, y: 435 }, end: { x: PAGE_WIDTH - margin, y: 435 }, thickness: 0.55, color: ink });
  let indexY = 422;
  const indexRowHeight = Math.min(25, Math.max(16, 364 / Math.max(1, input.cases.length)));
  input.cases.forEach((item, index) => {
    const ontology = item.review.validated_ae_ontology || {};
    const event = ontology.adverseEvents?.[0]?.value || item.record.potential_event;
    const values = [String(index + 1).padStart(2, "0"), printable(event, "Unspecified"), printable(item.record.author_identifier, "Unknown"), sourceDomain(item.record.source_url), compactDate(item.record.posted_at)];
    let x = margin;
    values.forEach((value, valueIndex) => {
      drawLines(cover, clippedLines(value, valueIndex < 2 ? bold : regular, valueIndex === 0 ? 6.4 : 6.2, indexWidths[valueIndex] - 7, 2), x, indexY, { font: valueIndex < 2 ? bold : regular, size: valueIndex === 0 ? 6.4 : 6.2, leading: 7.2 });
      x += indexWidths[valueIndex];
    });
    cover.drawLine({ start: { x: margin, y: indexY - indexRowHeight + 7 }, end: { x: PAGE_WIDTH - margin, y: indexY - indexRowHeight + 7 }, thickness: 0.3, color: rule });
    indexY -= indexRowHeight;
  });
  footerLabels.push("QA TEST ONLY - NOT FOR SPONSOR SUBMISSION");

  input.cases.forEach((item, index) => {
    const { record, review, transfer } = item;
    const ontology = review.validated_ae_ontology || {};
    const icsr = ontology.icsrAssessment || {};
    const minimum = icsr.minimumCriteria || {};
    const patient = icsr.patientAssessment || {};
    const reporter = icsr.reporterAssessment || {};
    const narrative = icsr.clinicalNarrative || {};
    const followUp = icsr.followUp || {};
    const duplicate = icsr.duplicateAssessment || {};
    const product = ontology.productProcedures?.[0]?.value || record.product_name;
    const event = ontology.adverseEvents?.[0]?.value || record.potential_event;
    const outcome = ontology.outcomes?.[0]?.category || ontology.outcomes?.[0]?.value;
    const causality = ontology.causality?.[0] || {};
    const criteriaMet = [minimum.suspectProduct, minimum.adverseEventOrObservation, minimum.identifiablePatient, minimum.identifiableReporter].every((criterion) => criterion?.status === "yes");
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    smallCaps(page, `AskSocial PV Compliance QA Test - ${record.therapeutic_area || area}`, margin, 748, muted, 6.2);
    page.drawText(`QA example ${index + 1} of ${input.cases.length}`, { x: margin, y: 723, size: 19, font: bold, color: ink });
    const statusText = "CLOSE NOT RELEVANT";
    const statusWidth = bold.widthOfTextAtSize(statusText, 6.3) + 16;
    page.drawRectangle({ x: PAGE_WIDTH - margin - statusWidth, y: 741, width: statusWidth, height: 17, color: qaRed });
    page.drawText(statusText, { x: PAGE_WIDTH - margin - statusWidth + 8, y: 747, size: 6.3, font: bold, color: rgb(1, 1, 1) });
    smallCaps(page, `Record ${record.id}`, PAGE_WIDTH - margin - 144, 730, muted, 5.2);
    smallCaps(page, `Review ${review.id}`, PAGE_WIDTH - margin - 144, 718, muted, 5.2);
    page.drawLine({ start: { x: margin, y: 708 }, end: { x: PAGE_WIDTH - margin, y: 708 }, thickness: 1.6, color: ink });

    const gap = 10;
    const topWidth = (width - (gap * 2)) / 3;
    const topXs = [margin, margin + topWidth + gap, margin + ((topWidth + gap) * 2)];
    const topSections: Array<[string, Array<[string, unknown, number?]>]> = [
      ["Case identification and source", [
        ["Therapeutic area", record.therapeutic_area], ["Lifecycle status", display(record.status)], ["Report type", display(icsr.reportType, "Undetermined")], ["Primary source", display(icsr.primarySourceType, "Unknown")], ["Evidence origin", record.import_batch_id ? "Social" : display(record.data_origin, "Unknown")], ["Source type", display(record.source_type)], ["Author / source", record.author_identifier], ["Language", record.original_language], ["Source URL", record.source_url, 3],
      ]],
      ["Governed chronology", [
        ["Publication", compactTimestamp(record.posted_at)], ["Collection", compactTimestamp(record.ingested_at)], ["Algorithm", compactTimestamp(record.created_at || record.identified_at)], ["Content available", compactTimestamp(record.identified_at)], ["Review start", compactTimestamp(record.review_started_at)], ["Day zero", compactTimestamp(record.reportability_identified_at)], ["Decision", compactTimestamp(review.reviewed_at)], ["Escalation", "Not applicable - record closed as Not Relevant", 3], ["Sponsor transfer", compactTimestamp(transfer?.transferred_at)],
      ]],
      ["Reviewer-approved safety assessment", [
        ["Product", product], ["Event", event], ["Classifications", review.classifications], ["Seriousness", display(ontology.seriousness?.value, "Unclear")], ["Seriousness criteria", icsr.seriousnessCriteria], ["Outcome", display(outcome, "Unknown")], ["Time to onset", `${display(ontology.timeToOnset?.category, "Unknown")} - ${printable(ontology.timeToOnset?.value, "No onset detail reported")}`, 2], ["Severity", display(ontology.severity?.value, "Unclear")], ["Unexpectedness", display(ontology.unexpectedness?.value, "Unclear")], ["Expectedness basis", display(ontology.unexpectedness?.basis, "Insufficient reference")], ["Causality", display(causality.value, "Not assessed")], ["Causality language", causality.phrase],
      ]],
    ];
    topSections.forEach(([title, rows], sectionIndex) => {
      let rowY = sectionTitle(page, title, topXs[sectionIndex], 693, topWidth);
      rows.forEach(([label, value, maximum]) => { rowY = row(page, topXs[sectionIndex], rowY, topWidth, label, value, { labelWidth: sectionIndex === 2 ? 74 : 76, maxLines: maximum || 2, valueSize: 6.2, minimumHeight: 12.2 }); });
    });
    page.drawLine({ start: { x: topXs[1] - (gap / 2), y: 701 }, end: { x: topXs[1] - (gap / 2), y: 502 }, thickness: 0.55, color: rule });
    page.drawLine({ start: { x: topXs[2] - (gap / 2), y: 701 }, end: { x: topXs[2] - (gap / 2), y: 502 }, thickness: 0.55, color: rule });
    page.drawLine({ start: { x: margin, y: 500 }, end: { x: PAGE_WIDTH - margin, y: 500 }, thickness: 1.5, color: ink });

    const leftWidth = 306;
    const rightX = margin + leftWidth + 10;
    const rightWidth = width - leftWidth - 10;
    let middleLeftY = sectionTitle(page, "ICH E2D(R1) minimum ICSR criteria", margin, 487, leftWidth);
    page.drawRectangle({ x: margin, y: middleLeftY - 20, width: leftWidth, height: 20, color: pale });
    smallCaps(page, "All four criteria met", margin + 6, middleLeftY - 13, muted, 5.1);
    drawLines(page, clippedLines(criteriaMet ? "Yes" : "No - missing or unclear criteria require follow-up", bold, 7.2, leftWidth - 90, 2), margin + 92, middleLeftY - 12, { font: bold, size: 7.2, leading: 8 });
    middleLeftY -= 27;
    middleLeftY = row(page, margin, middleLeftY, leftWidth, "Suspect product", statusValue(minimum.suspectProduct?.status, minimum.suspectProduct?.evidence, product), { labelWidth: 90, valueFont: bold, maxLines: 2, valueSize: 6.4 });
    middleLeftY = row(page, margin, middleLeftY, leftWidth, "AE / ADR observation", statusValue(minimum.adverseEventOrObservation?.status, minimum.adverseEventOrObservation?.evidence, event), { labelWidth: 90, valueFont: bold, maxLines: 2, valueSize: 6.4 });
    middleLeftY = row(page, margin, middleLeftY, leftWidth, "Identifiable patient", statusValue(minimum.identifiablePatient?.status, minimum.identifiablePatient?.evidence, "Not reported - follow-up required"), { labelWidth: 90, valueFont: bold, maxLines: 2, valueSize: 6.4 });
    middleLeftY = row(page, margin, middleLeftY, leftWidth, "Identifiable reporter", statusValue(minimum.identifiableReporter?.status, minimum.identifiableReporter?.evidence, "Not reported - follow-up required"), { labelWidth: 90, valueFont: bold, maxLines: 2, valueSize: 6.4 });
    const subY = middleLeftY - 4;
    const subGap = 8;
    const subWidth = (leftWidth - subGap) / 2;
    page.drawLine({ start: { x: margin, y: subY }, end: { x: margin + leftWidth, y: subY }, thickness: 0.6, color: ink });
    smallCaps(page, "Patient", margin, subY - 13, muted, 5.7);
    smallCaps(page, "Reporter", margin + subWidth + subGap, subY - 13, muted, 5.7);
    let patientY = subY - 19;
    let reporterY = subY - 19;
    [["Association", display(patient.association, "Unclear")], ["Existence status", display(patient.existenceStatus, "Not established")], ["Characteristic types", patient.characteristicTypes], ["Characteristics", patient.qualifyingCharacteristics], ["Reviewer confirmed", patient.reviewerConfirmed === true ? "Yes" : "No"], ["Verification evidence", patient.verificationEvidence], ["Follow-up feasibility", display(patient.followUpFeasibility, "Unclear")], ["Follow-up status", display(patient.followUpStatus, "Not started")]].forEach(([label, value]) => { patientY = stackedRow(page, margin, patientY, subWidth, String(label), value); });
    [["Relationship to event", display(reporter.relationship, "Unclear")], ["Existence status", display(reporter.existenceStatus, "Not established")], ["Characteristics", reporter.qualifyingCharacteristics], ["Verification evidence", reporter.verificationEvidence], ["Follow-up feasibility", display(reporter.followUpFeasibility, "Unclear")], ["Follow-up status", display(reporter.followUpStatus, "Not started")]].forEach(([label, value]) => { reporterY = stackedRow(page, margin + subWidth + subGap, reporterY, subWidth, String(label), value); });

    let managementY = sectionTitle(page, "Case management and reporting assessment", rightX, 487, rightWidth);
    page.drawLine({ start: { x: rightX, y: managementY }, end: { x: rightX, y: managementY - 42 }, thickness: 1.1, color: qaRed });
    smallCaps(page, "Reviewer rationale", rightX + 8, managementY - 8, muted, 5.2);
    drawLines(page, clippedLines(review.rationale, regular, 6.5, rightWidth - 13, 4), rightX + 8, managementY - 19, { size: 6.5, leading: 7.8 });
    managementY -= 49;
    [["Reviewer", review.reviewer_id], ["Follow-up needed", display(followUp.needed, "Unclear")], ["Follow-up questions", followUp.questions], ["Duplicate assessment", display(duplicate.status, "Not checked")], ["Duplicate reference", duplicate.reference], ["Regional reporting", icsr.regionalReportingAssessment || "Not assessed - sponsor must apply applicable regional and local requirements"], ["Transfer status", display(transfer?.status, "Not transferred")]].forEach(([label, value]) => { managementY = row(page, rightX, managementY, rightWidth, String(label), value, { labelWidth: 80, maxLines: String(label) === "Regional reporting" ? 3 : 2, valueSize: 6.1, minimumHeight: 13 }); });
    page.drawLine({ start: { x: rightX - 5, y: 494 }, end: { x: rightX - 5, y: 244 }, thickness: 0.55, color: rule });
    page.drawLine({ start: { x: margin, y: 239 }, end: { x: PAGE_WIDTH - margin, y: 239 }, thickness: 1.5, color: ink });

    const bottomGap = 10;
    const bottomWidth = (width - bottomGap) / 2;
    const clinicalX = margin + bottomWidth + bottomGap;
    let evidenceY = sectionTitle(page, "Unfiltered primary-source evidence", margin, 226, bottomWidth);
    drawLines(page, clippedLines(record.original_verbatim, regular, 6.4, bottomWidth, 13), margin, evidenceY - 4, { size: 6.4, leading: 7.7 });
    evidenceY -= 108;
    evidenceY = row(page, margin, evidenceY, bottomWidth, "Parent context", record.parent_context, { labelWidth: 78, maxLines: 2, valueSize: 5.8, minimumHeight: 13 });
    evidenceY = row(page, margin, evidenceY, bottomWidth, "Thread context", record.thread_context, { labelWidth: 78, maxLines: 2, valueSize: 5.8, minimumHeight: 13 });
    row(page, margin, evidenceY, bottomWidth, "Evidence hash", record.evidence_hash, { labelWidth: 78, maxLines: 3, valueSize: 5.3, minimumHeight: 13 });

    let clinicalY = sectionTitle(page, "Stand-alone clinical narrative inputs", clinicalX, 226, bottomWidth);
    [["Patient characteristics", narrative.patientCharacteristics], ["Therapy details", narrative.therapyDetails], ["Medical history", narrative.medicalHistory], ["Concurrent conditions", narrative.concurrentConditions], ["Diagnosis / lab", narrative.diagnosisAndLaboratoryEvidence], ["Alternative causes", narrative.alternativeCausesAndConfounders]].forEach(([label, value]) => { clinicalY = row(page, clinicalX, clinicalY, bottomWidth, String(label), value, { labelWidth: 82, maxLines: 2, valueSize: 5.9, minimumHeight: 13 }); });
    smallCaps(page, "Clinical course", clinicalX, clinicalY - 8, muted, 5.2);
    drawLines(page, clippedLines(narrative.clinicalCourse || "Verbatim as recorded under unfiltered primary-source evidence on this sheet.", regular, 6, bottomWidth, 5), clinicalX, clinicalY - 19, { size: 6, leading: 7.2, color: muted });
    page.drawLine({ start: { x: clinicalX - 5, y: 233 }, end: { x: clinicalX - 5, y: 47 }, thickness: 0.55, color: rule });
    footerLabels.push(`QA TEST ONLY - NOT FOR SPONSOR SUBMISSION | ${printable(ontology.ontologyVersion || record.ontology_version, "PV ontology")} / ${printable(record.classifier_version, "classifier")} / ${printable(record.library_version, "library")}`);
  });

  const pageCount = pdf.getPageCount();
  pdf.getPages().forEach((page, index) => {
    page.drawLine({ start: { x: margin, y: 39 }, end: { x: PAGE_WIDTH - margin, y: 39 }, thickness: 1.2, color: ink });
    const footer = footerLabels[index] || "QA TEST ONLY - NOT FOR SPONSOR SUBMISSION";
    page.drawText(footer, { x: margin, y: 25, size: 5.1, font: regular, color: muted });
    const pageLabel = `PAGE ${index + 1} OF ${pageCount}`;
    page.drawText(pageLabel, { x: PAGE_WIDTH - margin - regular.widthOfTextAtSize(pageLabel, 5.1), y: 25, size: 5.1, font: regular, color: muted });
  });
  const bytes = await pdf.save();
  return { bytes, hash: createHash("sha256").update(bytes).digest("hex"), generatedAt: input.generatedAt };
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
  if (qaMode) return createQaCaseSheetReport({ ...input, generatedAt });
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
