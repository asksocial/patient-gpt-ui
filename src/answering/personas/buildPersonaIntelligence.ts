import type { CanonicalFinding } from "../models/finding";
import { AUDIENCE_ROLES, CONVERSATION_SEGMENTS, type AudienceRole, type ConversationSegment } from "../../ingestion/audienceSegments";

export type PersonaIntelligenceSummary = {
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

/** Shares use the selected findings as denominator, never unique authors or
 * just the subset whose professional role can be inferred. */
export function buildPersonaIntelligence(findings: CanonicalFinding[]): PersonaIntelligenceSummary {
  const groups = new Map<AudienceRole, { findings: CanonicalFinding[]; content: Map<ConversationSegment, number> }>();
  for (const finding of findings) {
    const classification = finding.audienceClassification;
    if (!classification) continue;
    const group = groups.get(classification.audience) || { findings: [], content: new Map<ConversationSegment, number>() };
    group.findings.push(finding);
    group.content.set(classification.contentSegment, (group.content.get(classification.contentSegment) || 0) + 1);
    groups.set(classification.audience, group);
  }
  return {
    denominator: findings.length,
    classifiedCount: [...groups.values()].reduce((sum, group) => sum + group.findings.length, 0),
    roleCount: groups.size,
    segments: [...groups.entries()].map(([id, group]) => ({
      id, ...AUDIENCE_ROLES[id], count: group.findings.length,
      percent: findings.length ? Math.round(group.findings.length / findings.length * 10000) / 100 : 0,
      authorOrSourceEvidenceCount: group.findings.filter(f => ["author_metadata", "professional_self_description", "publication_metadata", "relationship_self_description"].includes(f.audienceClassification!.roleBasis)).length,
      reviewRequiredCount: group.findings.filter(f => f.audienceClassification!.reviewRequired).length,
      conversations: [...group.content.entries()].map(([segment, count]) => ({ id: segment, label: CONVERSATION_SEGMENTS[segment], count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
      evidenceIds: group.findings.slice(0, 3).map(f => f.findingId || (f as unknown as { id: string }).id),
      examples: group.findings.slice(0, 3).map(f => {
        const fields = f.rawMetadata?.fields || {};
        const url = String(fields.URL || "");
        return {
          id: f.findingId || (f as unknown as { id: string }).id,
          excerpt: String(fields["Hit Sentence"] || fields["Opening Text"] || f.summary || "").slice(0, 400),
          url: /^https?:\/\//i.test(url) ? url : undefined,
          roleEvidence: f.audienceClassification!.roleEvidence,
          roleBasis: f.audienceClassification!.roleBasis,
        };
      }),
    })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}
