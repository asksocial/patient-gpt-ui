import type { CanonicalFinding, EvidenceRef } from "../../answering/models/finding";
import { analyzeEvidence } from "../../answering/evidence/analyzeEvidence";
import type {
  EvidenceClass,
  EvidenceIntelligence,
  EvidenceVoice,
} from "../../answering/evidence/types";
import type { IntelligenceModuleId } from "../intelligence-platform/ids";

export type GeneratableModuleId = Exclude<IntelligenceModuleId, "patient">;

export type ModuleIntelligenceBuildOptions = {
  relevancePolicy?: "standard" | "prequalified";
};

export type ModuleEvidenceItem = {
  id: string;
  findingId: string;
  quote: string;
  fullMention: string;
  mentionTitle?: string;
  author?: string;
  publishedAt?: string;
  sourceLabel: string;
  url?: string;
  country?: string;
  platform?: string;
  voice: string;
  evidenceClass: string;
  qualityScore: number;
  qualityBand: string;
  promotionalContext: boolean;
  matchedSectionIds: string[];
  matchedSectionLabels: string[];
  contextualRelevanceScore: number;
};

type SectionDefinition = {
  id: string;
  label: string;
  description: string;
  pattern: RegExp;
};

type ModuleIntelligenceProfile = {
  moduleId: GeneratableModuleId;
  label: string;
  purpose: string;
  minimumQualityScore: number;
  preferredVoices: EvidenceVoice[];
  preferredClasses: EvidenceClass[];
  allowPromotionalContext: boolean;
  sections: SectionDefinition[];
  recommendations: string[];
};

export type ModuleIntelligenceResult = {
  schemaVersion: "module_intelligence_v1";
  moduleId: GeneratableModuleId;
  moduleLabel: string;
  therapeuticArea: string;
  generatedAt: string;
  headline: string;
  executiveSummary: string;
  dataQuality: {
    corpusFindingCount: number;
    eligibleFindingCount: number;
    selectedFindingCount: number;
    contextualEvidenceFindingCount: number;
    promotionalContextCount: number;
    lowQualityFindingCount: number;
    unclassifiedFindingCount: number;
    unspecifiedAudienceFindingCount: number;
    relevancePolicy: "standard" | "prequalified";
    assessment: "adequate" | "limited" | "insufficient";
    limitations: string[];
  };
  sections: Array<{
    id: string;
    label: string;
    description: string;
    findingCount: number;
    prevalencePercent: number;
    confidence: "high" | "moderate" | "directional" | "insufficient";
    evidenceIds: string[];
  }>;
  audienceSignals: Array<{ label: string; count: number }>;
  sourceSignals: Array<{ label: string; count: number }>;
  recommendations: string[];
  evidence: ModuleEvidenceItem[];
};

export type ModuleEvidenceCatalogResult = {
  moduleId: GeneratableModuleId;
  therapeuticArea: string;
  relevancePolicy: "standard" | "prequalified";
  query: string;
  qualityBand: string;
  evidenceClass: string;
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  items: ModuleEvidenceItem[];
  filters: {
    qualityBands: Array<{ label: string; count: number }>;
    evidenceClasses: Array<{ label: string; count: number }>;
  };
};

const PROMOTIONAL_CLASSES = new Set<EvidenceClass>([
  "clinic_marketing",
  "retail_or_product",
  "sponsored_content",
  "influencer_content",
]);

export const MODULE_INTELLIGENCE_PROFILES: Record<GeneratableModuleId, ModuleIntelligenceProfile> = {
  medical_affairs: {
    moduleId: "medical_affairs",
    label: "Medical Affairs",
    purpose: "scientific perception, evidence gaps, medical questions, and safety-relevant discussion",
    minimumQualityScore: 45,
    preferredVoices: ["provider", "researcher", "patient", "caregiver"],
    preferredClasses: ["research_journal", "clinical_study", "medical_society", "provider_conversation", "government_or_regulator", "healthcare_trade_publication", "patient_conversation"],
    allowPromotionalContext: false,
    sections: [
      { id: "scientific_perception", label: "Scientific perception", description: "How mechanisms, evidence, and clinical claims are being interpreted.", pattern: /study|evidence|science|clinical|mechanism|efficacy|effective|research|data|result/i },
      { id: "evidence_gaps", label: "Evidence gaps", description: "Questions or claims that lack clear support in the available evidence.", pattern: /unclear|unknown|lack of|limited evidence|question|prove|proven|misinformation|claim|hype/i },
      { id: "medical_questions", label: "Medical questions", description: "Recurring treatment, selection, outcome, and education questions.", pattern: /what is|how does|should|who is|candidate|selection|duration|compare|versus|outcome/i },
      { id: "safety_discussion", label: "Safety and tolerability", description: "Safety-related discussion requiring medical or PV-aware interpretation.", pattern: /safe|safety|risk|adverse|side effect|complication|pain|swelling|bruising|reaction/i },
    ],
    recommendations: [
      "Validate the leading scientific claims against approved evidence before external use.",
      "Prioritize medical education around the highest-volume evidence gaps and questions.",
      "Route potential safety content through the governed PV workflow rather than treating it as a confirmed event.",
    ],
  },
  clinical_trials: {
    moduleId: "clinical_trials",
    label: "Clinical Trials",
    purpose: "recruitment, retention, protocol burden, participant experience, site, and investigator signals",
    minimumQualityScore: 40,
    preferredVoices: ["patient", "caregiver", "provider", "researcher"],
    preferredClasses: ["clinical_study", "research_journal", "patient_conversation", "caregiver_conversation", "provider_conversation", "medical_society", "government_or_regulator"],
    allowPromotionalContext: false,
    sections: [
      { id: "awareness_trust", label: "Trial awareness and trust", description: "Awareness, understanding, confidence, and trust signals that shape trial consideration.", pattern: /clinical trial|clinical study|research study|awareness|learn about|heard about|trust|concern|experimental|investigational/i },
      { id: "recruitment", label: "Recruitment and enrollment", description: "Discovery, referral, enrollment, and access factors affecting recruitment.", pattern: /enroll|enrol|recruit|participant|volunteer|referral|screening|access|availability|join (the|a) study/i },
      { id: "eligibility", label: "Eligibility and patient selection", description: "Inclusion, exclusion, diagnosis, age, treatment-history, and selection considerations.", pattern: /eligible|eligibility|inclusion|exclusion|criteria|candidate|patient selection|diagnosis|treatment history|age (range|limit)/i },
      { id: "protocol", label: "Protocol and procedure burden", description: "Procedures, schedules, visits, randomization, controls, and treatment burdens relevant to protocol design.", pattern: /protocol|visit|procedure|schedule|randomi[sz]|placebo|control group|washout|dose|injection|assessment|questionnaire/i },
      { id: "retention", label: "Retention and follow-up", description: "Continued participation, withdrawal, adherence, follow-up, and completion signals.", pattern: /retention|withdraw|drop.?out|discontinu|continue|completion|follow.?up|lost to follow|adherence|commitment|remain in/i },
      { id: "site_experience", label: "Site and investigator experience", description: "Site access, investigator relationships, coordination, communication, travel, and operational experience.", pattern: /site|investigator|clinic|hospital|doctor|physician|coordinator|research team|communication|travel|location|distance/i },
      { id: "participant_experience", label: "Participant experience and burden", description: "Lived experience, convenience, emotional burden, quality of life, and practical participation needs.", pattern: /participant experience|patient experience|burden|convenien|quality of life|daily life|anxiety|fear|hope|support|time commitment|transport/i },
      { id: "outcomes_endpoints", label: "Outcomes and endpoints", description: "Efficacy, benefit, response, endpoints, measures, and longer-term results.", pattern: /outcome|endpoint|efficacy|effective|response|improvement|benefit|result|follow-up result|primary outcome|secondary outcome|long.?term/i },
      { id: "safety_tolerability", label: "Safety and tolerability", description: "Adverse events, tolerability, complications, discontinuation, and safety monitoring.", pattern: /safety|safe|adverse|side effect|tolerab|complication|serious event|reaction|toxicity|hospitali[sz]|monitoring/i },
    ],
    recommendations: [
      "Use the leading participant burdens as hypotheses for protocol and recruitment-material review.",
      "Validate social signals against registry, site, and operational data before changing trial design.",
      "Engage patient and site stakeholders to adjudicate the highest-priority recruitment and retention barriers.",
    ],
  },
  corporate_affairs: {
    moduleId: "corporate_affairs",
    label: "Corporate Affairs",
    purpose: "reputation, stakeholder perception, advocacy, and narrative risk",
    minimumQualityScore: 35,
    preferredVoices: ["journalist", "advocacy", "patient", "provider", "corporate", "community"],
    preferredClasses: ["healthcare_news", "consumer_news", "healthcare_trade_publication", "advocacy_organization", "community_conversation", "patient_conversation", "provider_conversation", "corporate_pr"],
    allowPromotionalContext: true,
    sections: [
      { id: "reputation", label: "Reputation signals", description: "Trust, credibility, leadership, and reputational risk signals.", pattern: /trust|credib|reputation|leadership|responsib|ethic|controvers|critici|praise/i },
      { id: "stakeholders", label: "Stakeholder perception", description: "How patients, providers, media, communities, and organizations frame the topic.", pattern: /patient|provider|doctor|media|community|organization|association|stakeholder|public/i },
      { id: "advocacy", label: "Advocacy ecosystem", description: "Advocacy priorities, partnerships, and community expectations.", pattern: /advocacy|advocate|awareness|nonprofit|foundation|association|campaign|support group/i },
      { id: "narratives", label: "Narrative shifts and issues", description: "Emerging narratives, misinformation, criticism, or issue escalation.", pattern: /narrative|trend|emerging|issue|misinformation|claim|debate|backlash|concern|risk/i },
    ],
    recommendations: [
      "Separate independent stakeholder perception from company-authored narrative when briefing leadership.",
      "Prepare evidence-backed responses for the highest-risk unresolved narratives.",
      "Track whether priority issues broaden across independent audiences and source categories.",
    ],
  },
  commercial: {
    moduleId: "commercial",
    label: "Commercial",
    purpose: "brand perception, customer needs, message response, adoption barriers, and market opportunity",
    minimumQualityScore: 35,
    preferredVoices: ["patient", "provider", "community", "journalist", "corporate", "clinic"],
    preferredClasses: ["patient_conversation", "provider_conversation", "community_conversation", "consumer_news", "healthcare_news", "healthcare_trade_publication", "clinic_marketing", "corporate_pr"],
    allowPromotionalContext: true,
    sections: [
      { id: "brand_perception", label: "Brand and category perception", description: "Perceptions of treatments, brands, categories, and expected outcomes.", pattern: /brand|product|treatment|procedure|result|quality|effective|popular|preference/i },
      { id: "adoption", label: "Adoption drivers and barriers", description: "Trust, price, access, safety, and outcome factors affecting adoption.", pattern: /adopt|try|consider|barrier|cost|price|access|trust|safe|risk|worth/i },
      { id: "message_response", label: "Message and claim response", description: "Response to benefits, claims, education, and promotional language.", pattern: /message|claim|benefit|education|awareness|promise|natural|lasting|proven|hype/i },
      { id: "opportunity", label: "Market opportunities", description: "Unmet needs, audience demand, and potential white-space signals.", pattern: /need|demand|opportunity|gap|unmet|looking for|want|alternative|new|emerging/i },
    ],
    recommendations: [
      "Use independent patient and provider evidence to validate market signals before activation.",
      "Test messages against the leading adoption barriers and unmet needs.",
      "Keep promotional and company-authored content visible as context, but separate it from independent corroboration.",
    ],
  },
  competitive: {
    moduleId: "competitive",
    label: "Competitive",
    purpose: "competitive landscape, positioning, alternatives, share of conversation, and white space",
    minimumQualityScore: 35,
    preferredVoices: ["patient", "provider", "journalist", "researcher", "corporate", "clinic"],
    preferredClasses: ["healthcare_news", "consumer_news", "healthcare_trade_publication", "provider_conversation", "patient_conversation", "research_journal", "corporate_pr", "clinic_marketing"],
    allowPromotionalContext: true,
    sections: [
      { id: "landscape", label: "Competitive landscape", description: "Treatments, brands, modalities, and alternatives appearing in the conversation.", pattern: /brand|compet|alternative|versus|compare|option|treatment|product|market/i },
      { id: "positioning", label: "Positioning signals", description: "Claims and attributes used to differentiate available options.", pattern: /position|different|unique|better|best|first|leading|innovative|premium|natural/i },
      { id: "switching", label: "Preference and switching", description: "Preference, substitution, switching, and dissatisfaction signals.", pattern: /prefer|switch|replace|instead|moving to|stopped|dissatisf|regret|recommend/i },
      { id: "white_space", label: "White-space opportunities", description: "Unmet needs and gaps not clearly addressed by current options.", pattern: /unmet|gap|need|missing|lack|wish|looking for|opportunity|concern|barrier/i },
    ],
    recommendations: [
      "Distinguish competitor-authored positioning from independent audience response.",
      "Validate switching and preference signals with direct, traceable audience evidence.",
      "Prioritize white space that recurs across multiple independent source and audience categories.",
    ],
  },
  advocacy: {
    moduleId: "advocacy",
    label: "Advocacy",
    purpose: "community priorities, organization activity, stakeholder needs, access, and policy signals",
    minimumQualityScore: 35,
    preferredVoices: ["advocacy", "patient", "caregiver", "community", "provider", "journalist"],
    preferredClasses: ["advocacy_organization", "patient_conversation", "caregiver_conversation", "community_conversation", "provider_conversation", "healthcare_news", "government_or_regulator"],
    allowPromotionalContext: false,
    sections: [
      { id: "community_priorities", label: "Community priorities", description: "Needs, burdens, and desired support expressed by affected communities.", pattern: /community|patient|caregiver|need|burden|support|experience|quality of life|voice/i },
      { id: "organizations", label: "Advocacy ecosystem", description: "Organizations, associations, campaigns, and partnership activity.", pattern: /advocacy|advocate|organization|association|foundation|nonprofit|campaign|coalition/i },
      { id: "access_equity", label: "Access and equity", description: "Access, affordability, inclusion, representation, and equity signals.", pattern: /access|afford|cost|equity|inequit|dispar|inclusion|represent|underserved|barrier/i },
      { id: "policy_awareness", label: "Policy and awareness", description: "Policy, public awareness, education, and institutional response.", pattern: /policy|government|regulat|awareness|education|rights|funding|coverage|legislation/i },
    ],
    recommendations: [
      "Validate priority needs directly with affected communities and advocacy partners.",
      "Map access and equity signals to specific audiences and markets before planning engagement.",
      "Keep company-authored and promotional content outside independent community corroboration counts.",
    ],
  },
};

function findingText(finding: CanonicalFinding) {
  const raw = finding as CanonicalFinding & Record<string, unknown>;
  return [
    finding.canonicalClaim,
    finding.summary,
    raw.title,
    raw.description,
    raw.text,
    raw.excerpt,
    ...(finding.normalizedLabels || []),
    ...(finding.symptoms || []),
    ...(finding.treatments || []),
    ...(finding.evidence || []).map((item) => item.excerpt),
  ].filter(Boolean).join(" ");
}

function findingId(finding: CanonicalFinding) {
  const raw = finding as CanonicalFinding & {
    id?: string;
    sourceId?: string;
  };
  return String(
    finding.findingId ||
      raw.id ||
      raw.sourceId ||
      finding.semanticFingerprint ||
      "unknown"
  ).replace(/^"+|"+$/g, "");
}

function bestEvidence(
  finding: CanonicalFinding,
  matchedSections: SectionDefinition[]
): EvidenceRef | undefined {
  return [...(finding.evidence || [])].sort((left, right) => {
    const leftMatches = matchedSections.filter((section) => section.pattern.test(left.excerpt || "")).length;
    const rightMatches = matchedSections.filter((section) => section.pattern.test(right.excerpt || "")).length;
    return rightMatches - leftMatches || (right.score || 0) - (left.score || 0);
  })[0];
}

function fallbackExcerpt(finding: CanonicalFinding) {
  const raw = finding as CanonicalFinding & {
    excerpt?: string;
    text?: string;
    description?: string;
    title?: string;
  };
  return String(
    raw.excerpt ||
      raw.text ||
      raw.description ||
      finding.summary ||
      finding.canonicalClaim ||
      raw.title ||
      "Evidence excerpt unavailable"
  ).trim();
}

function metadataString(
  finding: CanonicalFinding,
  ...keys: string[]
) {
  const value = keys
    .map((key) => finding.rawMetadata?.normalizedFields?.[key])
    .find((candidate) =>
      Array.isArray(candidate)
        ? candidate.some((item) => String(item || "").trim())
        : String(candidate || "").trim()
    );

  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).join("\n");
  }

  return String(value || "").trim();
}

function fullMention(finding: CanonicalFinding, source?: EvidenceRef) {
  const raw = finding as CanonicalFinding & {
    title?: string;
    description?: string;
    text?: string;
    excerpt?: string;
  };
  const candidates = [
    metadataString(finding, "full_text", "document_text", "article_body", "body", "content", "post_text", "opening_text", "text", "caption"),
    raw.text,
    raw.description,
    metadataString(finding, "description", "summary"),
    source?.excerpt,
    raw.excerpt,
    finding.summary,
    finding.canonicalClaim,
    metadataString(finding, "headline", "title"),
    raw.title,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return candidates.sort((left, right) => right.length - left.length)[0] || "Evidence mention unavailable";
}

function originalSourceUrl(finding: CanonicalFinding, source?: EvidenceRef) {
  const raw = finding as CanonicalFinding & { url?: string };
  const candidate = String(
    source?.url ||
      raw.url ||
      metadataString(finding, "url", "source_url", "source_link", "permalink", "link") ||
      ""
  ).trim();

  if (!candidate) return undefined;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

const EVIDENCE_CLASS_AUDIENCE: Record<EvidenceClass, string> = {
  patient_conversation: "patient",
  caregiver_conversation: "caregiver",
  provider_conversation: "provider",
  community_conversation: "community",
  advocacy_organization: "advocacy",
  research_journal: "researcher",
  clinical_study: "researcher",
  medical_society: "medical_society",
  government_or_regulator: "government_or_regulator",
  healthcare_trade_publication: "journalist",
  healthcare_news: "journalist",
  consumer_news: "journalist",
  corporate_pr: "corporate",
  clinic_marketing: "clinic",
  retail_or_product: "retail",
  sponsored_content: "sponsored_publisher",
  influencer_content: "influencer",
  youtube_review: "community",
  podcast: "community",
  forum: "community",
  personal_blog: "community",
  event_or_conference: "professional_event",
  unknown: "unspecified_audience",
};

function resolvedAudienceLabel(intelligence: EvidenceIntelligence) {
  if (intelligence.voice !== "unknown") return intelligence.voice;
  const classAudience = EVIDENCE_CLASS_AUDIENCE[intelligence.evidenceClass];
  if (classAudience !== "unspecified_audience") return classAudience;
  if (intelligence.platform === "research") return "researcher";
  if (intelligence.platform === "news") return "journalist";
  if (intelligence.platform === "government") return "government_or_regulator";
  if (intelligence.platform === "retail") return "retail";
  if (intelligence.platform === "event") return "professional_event";
  if (["social", "forum", "review", "video", "blog", "podcast"].includes(intelligence.platform)) {
    return "community";
  }
  return "unspecified_audience";
}

function clinicalTrialsEvidenceClass(
  finding: CanonicalFinding,
  intelligence: EvidenceIntelligence
): EvidenceClass {
  if (intelligence.evidenceClass !== "unknown") return intelligence.evidenceClass;

  const url = originalSourceUrl(finding) || "";
  const hostname = (() => {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const source = metadataString(finding, "source", "publication", "source_name", "platform").toLowerCase();
  const title = metadataString(finding, "headline", "title").toLowerCase();
  const text = `${title} ${source} ${findingText(finding).toLowerCase()}`;

  if (hostname === "clinicaltrials.gov" || /\bclinicaltrials\.gov\b/.test(text)) return "clinical_study";
  if (
    intelligence.platform === "research" ||
    /(?:pubmed|ncbi\.nlm\.nih\.gov|sciencedirect|springer|wiley|jamanetwork|bmj\.com|nejm\.org|nature\.com|frontiersin|mdpi\.com)/.test(hostname)
  ) return "research_journal";
  if (intelligence.platform === "government" || /\.gov$/.test(hostname)) return "government_or_regulator";
  if (intelligence.platform === "forum") return "forum";
  if (intelligence.platform === "review") {
    if (intelligence.voice === "patient") return "patient_conversation";
    if (intelligence.voice === "caregiver") return "caregiver_conversation";
    if (intelligence.voice === "provider") return "provider_conversation";
    return "community_conversation";
  }
  if (intelligence.platform === "social" || /\b(twitter|linkedin|bluesky|facebook|instagram|tiktok|pinterest)\b/.test(source)) {
    if (intelligence.voice === "patient") return "patient_conversation";
    if (intelligence.voice === "caregiver") return "caregiver_conversation";
    if (intelligence.voice === "provider") return "provider_conversation";
    if (intelligence.voice === "corporate") return "corporate_pr";
    if (intelligence.voice === "clinic") return "clinic_marketing";
    if (intelligence.voice === "influencer") return "influencer_content";
    return "community_conversation";
  }
  if (intelligence.platform === "video" || /\b(?:youtube|vimeo)\b/.test(source)) return "youtube_review";
  if (intelligence.platform === "podcast") return "podcast";
  if (intelligence.platform === "blog" || /(?:wordpress\.com|blogspot\.com|substack\.com|medium\.com)$/.test(hostname)) return "personal_blog";
  if (intelligence.platform === "retail") return "retail_or_product";
  if (intelligence.platform === "event") return "event_or_conference";
  if (intelligence.platform === "news") return "consumer_news";
  if (
    /(?:prnewswire|businesswire|globenewswire|accesswire|einpresswire|newsfilecorp)/.test(hostname) ||
    /\b(?:press release|news release)\b/.test(text) ||
    /\b(?:announces?|receives? approval|submits? (?:an )?application|positive topline|new data reinforces)\b/.test(title)
  ) return "corporate_pr";
  if (url && (title || source)) return "consumer_news";
  if (title && !/content is not available/.test(title)) return "consumer_news";

  return "unknown";
}

function applyModuleEvidenceClassification(
  moduleId: GeneratableModuleId,
  finding: CanonicalFinding,
  intelligence: EvidenceIntelligence
): EvidenceIntelligence {
  if (moduleId !== "clinical_trials" || intelligence.evidenceClass !== "unknown") return intelligence;
  const evidenceClass = clinicalTrialsEvidenceClass(finding, intelligence);
  if (evidenceClass === "unknown") return intelligence;
  const isPromotional = ["corporate_pr", "clinic_marketing", "retail_or_product", "sponsored_content", "influencer_content", "event_or_conference"].includes(evidenceClass);
  return {
    ...intelligence,
    evidenceClass,
    isFirstParty: ["corporate_pr", "clinic_marketing", "retail_or_product"].includes(evidenceClass),
    isPromotional,
    reasons: [...intelligence.reasons, `Clinical Trials metadata fallback: ${evidenceClass}`],
  };
}

function contextualizeFinding(
  profile: ModuleIntelligenceProfile,
  item: { finding: CanonicalFinding; intelligence: EvidenceIntelligence }
) {
  const text = findingText(item.finding);
  const matchedSections = profile.sections.filter((section) => section.pattern.test(text));
  const sectionPriorityScore = matchedSections.reduce((total, section) => {
    const index = profile.sections.findIndex((candidate) => candidate.id === section.id);
    return total + Math.max(1, profile.sections.length - index);
  }, 0);
  return {
    ...item,
    matchedSections,
    contextualRelevanceScore:
      matchedSections.length * 100 +
      sectionPriorityScore * 10 +
      (profile.preferredClasses.includes(item.intelligence.evidenceClass) ? 20 : 0) +
      (profile.preferredVoices.includes(resolvedAudienceLabel(item.intelligence) as EvidenceVoice) ? 10 : 0) +
      item.intelligence.qualityScore,
  };
}

function buildEvidenceItem(
  moduleId: GeneratableModuleId,
  finding: CanonicalFinding,
  intelligence: EvidenceIntelligence,
  matchedSections: SectionDefinition[],
  contextualRelevanceScore: number
): ModuleEvidenceItem {
  const source = bestEvidence(finding, matchedSections);
  return {
    id: `${moduleId}:${findingId(finding)}`,
    findingId: findingId(finding),
    quote: source?.excerpt || fallbackExcerpt(finding),
    fullMention: fullMention(finding, source),
    mentionTitle: metadataString(finding, "headline", "title") || undefined,
    author: metadataString(finding, "influencer", "author", "author_name", "username") || undefined,
    publishedAt: metadataString(finding, "date", "published_at", "published_date", "alternate_date_format") || undefined,
    sourceLabel: source?.platform || intelligence.domain || intelligence.platform || "Source metadata unavailable",
    url: originalSourceUrl(finding, source),
    country: source?.country || metadataString(finding, "country") || undefined,
    platform: source?.platform || intelligence.platform,
    voice: resolvedAudienceLabel(intelligence),
    evidenceClass: intelligence.evidenceClass,
    qualityScore: intelligence.qualityScore,
    qualityBand: intelligence.qualityBand,
    promotionalContext: intelligence.isPromotional || intelligence.evidenceClass === "corporate_pr",
    matchedSectionIds: matchedSections.map((section) => section.id),
    matchedSectionLabels: matchedSections.map((section) => section.label),
    contextualRelevanceScore,
  };
}

function normalizeMention(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function mentionKey(
  finding: CanonicalFinding,
  matchedSections: SectionDefinition[]
) {
  const source = bestEvidence(finding, matchedSections);
  const normalized = normalizeMention(source?.excerpt || fallbackExcerpt(finding));
  return normalized || `finding:${findingId(finding)}`;
}

function countLabels(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 8);
}

function countAllLabels(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function confidence(count: number, denominator: number) {
  if (!count) return "insufficient" as const;
  const ratio = denominator ? count / denominator : 0;
  if (count >= 8 && ratio >= 0.1) return "high" as const;
  if (count >= 3) return "moderate" as const;
  return "directional" as const;
}

export function isGeneratableModuleId(value: unknown): value is GeneratableModuleId {
  return typeof value === "string" && value !== "patient" && value in MODULE_INTELLIGENCE_PROFILES;
}

export function buildModuleIntelligence(
  moduleId: GeneratableModuleId,
  therapeuticArea: string,
  findings: CanonicalFinding[],
  generatedAt = new Date().toISOString(),
  options: ModuleIntelligenceBuildOptions = {}
): ModuleIntelligenceResult {
  const profile = MODULE_INTELLIGENCE_PROFILES[moduleId];
  const relevancePolicy = options.relevancePolicy || "standard";
  const relevancePrequalified = relevancePolicy === "prequalified";
  const analyzed = findings.map((finding) => ({
    finding,
    intelligence: applyModuleEvidenceClassification(moduleId, finding, analyzeEvidence(finding)),
  }));
  const qualityEligible = analyzed.filter(({ intelligence }) => intelligence.qualityScore >= profile.minimumQualityScore);
  const eligible = relevancePrequalified
    ? analyzed
    : qualityEligible.filter(({ intelligence }) =>
        profile.allowPromotionalContext || !PROMOTIONAL_CLASSES.has(intelligence.evidenceClass)
      );
  const preferred = eligible.filter(({ intelligence }) =>
    profile.preferredVoices.includes(resolvedAudienceLabel(intelligence) as EvidenceVoice) ||
    profile.preferredClasses.includes(intelligence.evidenceClass)
  );
  const selected = relevancePrequalified ? eligible : preferred.length >= 8 ? preferred : eligible;
  const promotionalContextCount = selected.filter(({ intelligence }) =>
    intelligence.isPromotional || intelligence.evidenceClass === "corporate_pr"
  ).length;

  const contextualized = selected.map((item) => contextualizeFinding(profile, item));
  const contextualEvidence = contextualized.filter((item) => item.matchedSections.length > 0);

  const sections = profile.sections.map((section) => {
    const matching = contextualized.filter(({ matchedSections }) =>
      matchedSections.some((matched) => matched.id === section.id)
    );
    return {
      id: section.id,
      label: section.label,
      description: section.description,
      findingCount: matching.length,
      prevalencePercent: selected.length ? Math.round((matching.length / selected.length) * 1000) / 10 : 0,
      confidence: confidence(matching.length, selected.length),
      evidenceIds: matching.slice(0, 8).map(({ finding }) => findingId(finding)),
    };
  }).sort((left, right) => right.findingCount - left.findingCount);

  const evidenceItems: (typeof contextualEvidence)[number][] = [];
  const usedFindingIds = new Set<string>();
  const usedMentionKeys = new Set<string>();
  function appendEvidenceCandidate(item: (typeof contextualEvidence)[number]) {
    const id = findingId(item.finding);
    const normalizedMention = mentionKey(item.finding, item.matchedSections);
    if (usedFindingIds.has(id) || usedMentionKeys.has(normalizedMention)) return;
    usedFindingIds.add(id);
    usedMentionKeys.add(normalizedMention);
    evidenceItems.push(item);
  }
  for (const section of profile.sections) {
    const sectionCandidates = contextualEvidence
      .filter((item) => item.matchedSections.some((matched) => matched.id === section.id))
      .sort((left, right) =>
        right.contextualRelevanceScore - left.contextualRelevanceScore ||
        right.intelligence.qualityScore - left.intelligence.qualityScore
      )
      .slice(0, 4);
    for (const item of sectionCandidates) appendEvidenceCandidate(item);
  }
  for (const item of [...contextualEvidence].sort((left, right) =>
    right.contextualRelevanceScore - left.contextualRelevanceScore ||
    right.intelligence.qualityScore - left.intelligence.qualityScore
  )) {
    if (evidenceItems.length >= 16) break;
    appendEvidenceCandidate(item);
  }

  const evidence = evidenceItems
    .slice(0, 16)
    .map(({ finding, intelligence, matchedSections, contextualRelevanceScore }) =>
      buildEvidenceItem(moduleId, finding, intelligence, matchedSections, contextualRelevanceScore)
    );

  const assessment = selected.length >= 30 ? "adequate" : selected.length >= 8 ? "limited" : "insufficient";
  const leading = sections[0];
  const limitations = [
    "Audience and evidence classifications are machine-derived and should be human-reviewed for consequential use.",
    `This analysis reflects the available ${therapeuticArea} corpus and is not a statistically representative market sample.`,
    relevancePrequalified
      ? "The dedicated Meltwater export is treated as pre-qualified for relevance; evidence-quality labels rank mentions without removing them from analysis."
      : profile.allowPromotionalContext
      ? "Promotional and company-authored evidence is retained as labeled context and does not establish independent corroboration."
      : "Promotional evidence is excluded from the module evidence subset.",
    ...(relevancePrequalified
      ? ["Commercial, promotional, and unclassified mentions remain available as explicitly labeled context rather than independent corroboration."]
      : []),
  ];

  return {
    schemaVersion: "module_intelligence_v1",
    moduleId,
    moduleLabel: profile.label,
    therapeuticArea,
    generatedAt,
    headline: leading?.findingCount
      ? `${leading.label} is the most prevalent ${profile.label} signal in the available ${therapeuticArea} evidence.`
      : `The available ${therapeuticArea} evidence does not yet support a clear ${profile.label} priority signal.`,
    executiveSummary: `${profile.label} Intelligence evaluated ${selected.length} eligible findings from ${findings.length} corpus records for ${profile.purpose}. Results are evidence-qualified and should be interpreted with the stated coverage limitations.`,
    dataQuality: {
      corpusFindingCount: findings.length,
      eligibleFindingCount: eligible.length,
      selectedFindingCount: selected.length,
      contextualEvidenceFindingCount: contextualEvidence.length,
      promotionalContextCount,
      lowQualityFindingCount: selected.filter(({ intelligence }) => intelligence.qualityScore < profile.minimumQualityScore).length,
      unclassifiedFindingCount: selected.filter(({ intelligence }) => intelligence.evidenceClass === "unknown").length,
      unspecifiedAudienceFindingCount: selected.filter(({ intelligence }) => resolvedAudienceLabel(intelligence) === "unspecified_audience").length,
      relevancePolicy,
      assessment,
      limitations,
    },
    sections,
    audienceSignals: countLabels(selected.map(({ intelligence }) => resolvedAudienceLabel(intelligence))),
    sourceSignals: countLabels(selected.map(({ intelligence }) => intelligence.evidenceClass)),
    recommendations: profile.recommendations,
    evidence,
  };
}

export function buildModuleEvidenceCatalog(
  moduleId: GeneratableModuleId,
  therapeuticArea: string,
  findings: CanonicalFinding[],
  params: {
    query?: string;
    qualityBand?: string;
    evidenceClass?: string;
    page?: number;
    pageSize?: number;
  } = {},
  options: ModuleIntelligenceBuildOptions = {}
): ModuleEvidenceCatalogResult {
  const profile = MODULE_INTELLIGENCE_PROFILES[moduleId];
  const relevancePolicy = options.relevancePolicy || "standard";
  const query = String(params.query || "").trim();
  const normalizedQuery = query.toLowerCase();
  const qualityBand = String(params.qualityBand || "").trim();
  const evidenceClass = String(params.evidenceClass || "").trim();
  const requestedPageSize = Number.isFinite(params.pageSize) ? Number(params.pageSize) : 12;
  const pageSize = Math.min(50, Math.max(6, Math.floor(requestedPageSize)));

  const contextualized = findings
    .map((finding) => ({
      finding,
      intelligence: applyModuleEvidenceClassification(moduleId, finding, analyzeEvidence(finding)),
    }))
    .map((item) => contextualizeFinding(profile, item));

  const filtered = contextualized
    .filter(({ finding, intelligence, matchedSections }) => {
      if (qualityBand && intelligence.qualityBand !== qualityBand) return false;
      if (evidenceClass && intelligence.evidenceClass !== evidenceClass) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        findingText(finding),
        metadataString(finding, "headline", "title"),
        metadataString(finding, "source", "publication", "influencer", "author", "country"),
        intelligence.domain,
        intelligence.evidenceClass,
        resolvedAudienceLabel(intelligence),
        ...matchedSections.map((section) => section.label),
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(normalizedQuery);
    })
    .sort((left, right) =>
      right.intelligence.qualityScore - left.intelligence.qualityScore ||
      right.matchedSections.length - left.matchedSections.length ||
      right.contextualRelevanceScore - left.contextualRelevanceScore ||
      findingId(left.finding).localeCompare(findingId(right.finding))
    );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(params.page) || 1)));
  const offset = (page - 1) * pageSize;
  const items = filtered
    .slice(offset, offset + pageSize)
    .map(({ finding, intelligence, matchedSections, contextualRelevanceScore }) =>
      buildEvidenceItem(moduleId, finding, intelligence, matchedSections, contextualRelevanceScore)
    );

  return {
    moduleId,
    therapeuticArea,
    relevancePolicy,
    query,
    qualityBand,
    evidenceClass,
    page,
    pageSize,
    pageCount,
    total: filtered.length,
    items,
    filters: {
      qualityBands: countAllLabels(contextualized.map(({ intelligence }) => intelligence.qualityBand)),
      evidenceClasses: countAllLabels(contextualized.map(({ intelligence }) => intelligence.evidenceClass)),
    },
  };
}
