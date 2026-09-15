import { getActivePvEmailMapping } from "./config";
import type { PvE2bAlignedCase, PvEmailFieldConfig } from "./types";

export type PvClientNotificationSection = {
  name: string;
  fields: Array<{ field: string; label: string; value: unknown }>;
};

export type PvClientNotificationPayload = {
  title: "POTENTIAL AE/ADR CASE IDENTIFIED";
  caseId: string;
  mappingVersion: string;
  emailMappingVersion: string;
  sections: PvClientNotificationSection[];
  disclaimer: string;
};

function pathValue(value: unknown, path: string): unknown {
  return path.split(".").reduce((current: any, segment) => {
    if (current === null || current === undefined) return undefined;
    const index = Number(segment);
    return Number.isInteger(index) && String(index) === segment ? current[index] : current[segment];
  }, value as any);
}

function meaningful(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as object).length > 0;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function shouldInclude(config: PvEmailFieldConfig, value: unknown) {
  if (config.include === "never") return false;
  if (config.include === "always") return meaningful(value) || config.displayUnknown === true;
  if (config.include === "when_present") return meaningful(value);
  if (config.include === "when_flagged") return Array.isArray(value) ? value.length > 0 : value === true || meaningful(value);
  return false;
}

function emailValue(config: PvEmailFieldConfig, value: unknown) {
  if (!meaningful(value)) return config.displayUnknown ? "Not reported" : undefined;
  return value;
}

export function buildPvClientNotification(caseData: PvE2bAlignedCase): PvClientNotificationPayload {
  const emailConfig = getActivePvEmailMapping();
  const sections = new Map<string, PvClientNotificationSection>();
  for (const config of [...emailConfig.fields].sort((a, b) => a.order - b.order)) {
    const value = pathValue(caseData, config.field);
    if (!shouldInclude(config, value)) continue;
    const section = sections.get(config.section) || { name: config.section, fields: [] };
    section.fields.push({ field: config.field, label: config.label, value: emailValue(config, value) });
    sections.set(config.section, section);
  }
  return {
    title: "POTENTIAL AE/ADR CASE IDENTIFIED",
    caseId: caseData.id,
    mappingVersion: caseData.e2bMappingVersion,
    emailMappingVersion: emailConfig.emailMappingVersion,
    sections: Array.from(sections.values()).filter((section) => section.fields.length > 0),
    disclaimer: emailConfig.disclaimer,
  };
}

export function escapePvEmailHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function printable(value: unknown): string {
  if (Array.isArray(value)) return value.map(printable).join("; ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => meaningful(nested))
      .map(([key, nested]) => `${key.replaceAll("_", " ")}: ${printable(nested)}`)
      .join("; ");
  }
  return String(value ?? "Not reported");
}

export function renderPvClientNotificationHtml(payloads: PvClientNotificationPayload[]) {
  const body = payloads.map((payload) => {
    const sections = payload.sections.map((section) => `<section><h3>${escapePvEmailHtml(section.name)}</h3><dl>${section.fields.map((field) => `<dt><strong>${escapePvEmailHtml(field.label)}</strong></dt><dd>${escapePvEmailHtml(printable(field.value))}</dd>`).join("")}</dl></section>`).join("");
    return `<article><h2>${escapePvEmailHtml(payload.title)}</h2><p><strong>AskSocial Case ID:</strong> ${escapePvEmailHtml(payload.caseId)}</p>${sections}<p><small>Mapping ${escapePvEmailHtml(payload.mappingVersion)} · Email configuration ${escapePvEmailHtml(payload.emailMappingVersion)}</small></p></article>`;
  }).join("<hr />");
  const disclaimer = payloads[0]?.disclaimer || getActivePvEmailMapping().disclaimer;
  return `${body}<hr /><p><em>${escapePvEmailHtml(disclaimer)}</em></p>`;
}
