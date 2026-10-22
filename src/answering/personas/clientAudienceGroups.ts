import type { Glp1AudienceClassification } from "../../ingestion/glp1Audience";
import type { AudienceRole } from "../../ingestion/audienceSegments";
import type { PersonaIntelligenceSummary } from "./buildPersonaIntelligence";

export const CLIENT_AUDIENCE_GROUPS = [
  { id: "patients_circle", label: "Patients & Their Circle", description: "All patient-related conversations, including personal accounts, support communities, caregivers and family, reported stories, reposts and testimonials." },
  { id: "healthcare_science", label: "Healthcare & Science", description: "Clinical professionals, care services and scientific organizations." },
  { id: "health_wellness_influencers", label: "Health & Wellness Influencers", description: "Health, wellness, nutrition and fitness creators without established clinical credentials." },
  { id: "industry_markets", label: "Industry & Markets", description: "Commercial organizations and financial or market commentators." },
  { id: "media_advocacy", label: "Media & Advocacy", description: "News, media and advocacy organizations framing the public narrative." },
  { id: "general_public", label: "General Public", description: "Public views without an established personal or professional role." },
  { id: "excluded_off_topic", label: "Excluded / Off-topic", description: "Outside the medication topic; retained for source-corpus reconciliation, separate from audiences." },
] as const;

type ClientAudienceGroupId = typeof CLIENT_AUDIENCE_GROUPS[number]["id"];
export const CLIENT_GROUP_BY_ROLE: Record<AudienceRole, ClientAudienceGroupId> = {
  patient: "patients_circle", patient_community: "patients_circle", caregiver: "patients_circle", family_peer: "patients_circle",
  provider_hcp: "healthcare_science", clinic_telehealth: "healthcare_science", researcher: "healthcare_science", public_authority: "healthcare_science",
  health_educator: "health_wellness_influencers", wellness_creator: "health_wellness_influencers",
  company_or_commercial: "industry_markets", investor_analyst: "industry_markets", legal_services: "industry_markets",
  news_media: "media_advocacy", advocacy: "media_advocacy", media_or_research: "media_advocacy",
  public_discussion: "general_public", general_discussion: "general_public", community_observer: "general_public", insufficient_context: "general_public",
  off_topic: "excluded_off_topic",
};

export type ClientAudienceGroup = {
  id: ClientAudienceGroupId; label: string; description: string; excluded: boolean;
  count: number; percent: number;
  subtypes: PersonaIntelligenceSummary["segments"];
};

/** Patient-related content takes precedence over the source role. A post
 * about patient experience is counted once, in Patients & Their Circle. */
export function clientGroupForClassification(classification: Pick<Glp1AudienceClassification, "audience" | "patientContent">): ClientAudienceGroupId {
  return classification.patientContent ? "patients_circle" : CLIENT_GROUP_BY_ROLE[classification.audience];
}

/** Record partitions are summarized independently so patient-related media,
 * commercial and public posts are removed from their former client groups. */
export function groupClientAudiences(segments: PersonaIntelligenceSummary["segments"], denominator: number, partitions?: Map<string, PersonaIntelligenceSummary["segments"]>): ClientAudienceGroup[] {
  return CLIENT_AUDIENCE_GROUPS.map(definition => {
    const subtypes = partitions?.get(definition.id) || (partitions ? [] : segments.filter(segment => CLIENT_GROUP_BY_ROLE[segment.id] === definition.id));
    const count = subtypes.reduce((sum, subtype) => sum + subtype.count, 0);
    return { ...definition, excluded: definition.id === "excluded_off_topic", count,
      percent: denominator ? Math.round(count / denominator * 10000) / 100 : 0, subtypes };
  });
}
