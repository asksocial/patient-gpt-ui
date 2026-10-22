import { groupClientAudiences, type ClientAudienceGroup } from "./clientAudienceGroups";
import type { Glp1AudienceClassification } from "../../ingestion/glp1Audience";

export type PersonaRecord = {
  findingId?: string; id?: string; summary?: string;
  rawMetadata?: { fields?: Record<string, unknown> };
  audienceClassification?: Glp1AudienceClassification;
};
import { AUDIENCE_ROLES, CONVERSATION_SEGMENTS, type AudienceRole, type ConversationSegment } from "../../ingestion/audienceSegments";

export type PersonaIntelligenceSummary = {
  clientGroups: ClientAudienceGroup[];
  scope: "full_corpus" | "selected_findings";
  analyticalCount?: number;
  excludedFromAnalysisCount?: number;
  patientRelated: {
    count: number; percent: number; likelyVoiceCount: number;
    breakdown: Array<{ id: string; label: string; count: number; percent: number }>;
  };
  denominator: number;
  classifiedCount: number;
  roleCount: number;
  segments: Array<{
    id: AudienceRole; label: string; description: string; count: number; percent: number;
    authorOrSourceEvidenceCount: number; reviewRequiredCount: number;
    conversations: Array<{ id: ConversationSegment; label: string; count: number }>;
    evidenceIds: string[];
    examples: Array<{ id: string; excerpt: string; url?: string; roleEvidence: string[]; roleBasis: string }>;
  }>;
};

/** Aggregate the explicit universe supplied by the caller. Ranked evidence
 * examples must never become the universe for a corpus composition report. */
export function buildPersonaIntelligence(findings: PersonaRecord[], options: { scope?: PersonaIntelligenceSummary["scope"]; analyticalCount?: number } = {}): PersonaIntelligenceSummary {
  const groups = new Map<AudienceRole, { findings: PersonaRecord[]; content: Map<ConversationSegment, number> }>();
  const relatedGroups = [
    { id: "likely_personal_experience", label: "Likely personal treatment experiences" },
    { id: "prospective_patient", label: "Prospective-patient questions" },
    { id: "likely_caregiver_experience", label: "Likely caregiver experiences" },
    { id: "patient_community_discussion", label: "Patient support-community context" },
    { id: "reported_patient_story", label: "Media-reported patient stories" },
    { id: "reshared_patient_account", label: "Reposted patient accounts" },
    { id: "commercial_patient_testimonial", label: "Commercially influenced patient testimonials" },
    { id: "third_party_patient_context", label: "Family, peer or other third-party patient references" },
  ];
  const relatedCounts = new Map<string, number>();
  const percent = (count: number) => findings.length ? Math.round(count / findings.length * 10000) / 100 : 0;
  let patientRelatedCount = 0;
  let likelyVoiceCount = 0;
  for (const finding of findings) {
    const classification = finding.audienceClassification;
    if (!classification) continue;
    if (classification.eligiblePatientVoice) likelyVoiceCount++;
    if (classification.patientContent) {
      patientRelatedCount++;
      const id = relatedGroups.some(group => group.id === classification.designation) ? classification.designation : "third_party_patient_context";
      relatedCounts.set(id, (relatedCounts.get(id) || 0) + 1);
    }
    const group = groups.get(classification.audience) || { findings: [], content: new Map<ConversationSegment, number>() };
    group.findings.push(finding);
    group.content.set(classification.contentSegment, (group.content.get(classification.contentSegment) || 0) + 1);
    groups.set(classification.audience, group);
  }
  const summary = {
    scope: options.scope || "selected_findings" as const,
    analyticalCount: options.analyticalCount,
    excludedFromAnalysisCount: options.analyticalCount === undefined ? undefined : findings.length - options.analyticalCount,
    patientRelated: {
      count: patientRelatedCount, percent: percent(patientRelatedCount), likelyVoiceCount,
      breakdown: relatedGroups.map(group => ({ ...group, count: relatedCounts.get(group.id) || 0, percent: percent(relatedCounts.get(group.id) || 0) })).filter(group => group.count),
    },
    denominator: findings.length,
    classifiedCount: [...groups.values()].reduce((sum, group) => sum + group.findings.length, 0),
    roleCount: groups.size,
    segments: [...groups.entries()].map(([id, group]) => ({
      id, ...AUDIENCE_ROLES[id], count: group.findings.length,
      percent: percent(group.findings.length),
      authorOrSourceEvidenceCount: group.findings.filter(f => ["author_metadata", "professional_self_description", "publication_metadata", "relationship_self_description"].includes(f.audienceClassification!.roleBasis)).length,
      reviewRequiredCount: group.findings.filter(f => f.audienceClassification!.reviewRequired).length,
      conversations: [...group.content.entries()].map(([segment, count]) => ({ id: segment, label: CONVERSATION_SEGMENTS[segment], count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
      evidenceIds: group.findings.slice(0, 3).map(f => f.findingId || f.id || ""),
      examples: group.findings.slice(0, 3).map(f => {
        const fields = f.rawMetadata?.fields || {};
        const url = String(fields.URL || "");
        return {
          id: f.findingId || f.id || "",
          excerpt: String(fields["Hit Sentence"] || fields["Opening Text"] || f.summary || "").slice(0, 400),
          url: /^https?:\/\//i.test(url) ? url : undefined,
          roleEvidence: f.audienceClassification!.roleEvidence,
          roleBasis: f.audienceClassification!.roleBasis,
        };
      }),
    })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
  return { ...summary, clientGroups: groupClientAudiences(summary.segments, summary.denominator) };
}
