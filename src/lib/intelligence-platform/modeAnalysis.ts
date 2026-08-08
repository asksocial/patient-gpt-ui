import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import type {
  EvidenceClass,
  EvidenceIntelligence,
  EvidenceVoice,
} from "../../answering/evidence/types";
import type {
  AiAgentId,
  IntelligenceModuleId,
} from "./ids";

export type ModeTaxonomyConcept = {
  id: string;
  label: string;
  dimension: string;
  keywords: string[];
};

export type ModeEvidencePolicy = {
  preferredEvidenceClasses: EvidenceClass[];
  admissibleEvidenceClasses: EvidenceClass[];
  excludedEvidenceClasses: EvidenceClass[];
  preferredVoices: EvidenceVoice[];
  minimumQualityScore: number;
  promotionalHandling:
    | "exclude"
    | "context_only"
    | "screen_all";
  minimumRetainedFindings: number;
};

export type ModeOutputSection = {
  id: string;
  title: string;
  purpose: string;
};

export type ModeAnalysisProfile = {
  modeId: AiAgentId;
  label: string;
  version: string;
  moduleIds: IntelligenceModuleId[];
  analysisInstructions: string[];
  evidencePolicy: ModeEvidencePolicy;
  taxonomy: ModeTaxonomyConcept[];
  outputContract: {
    id: string;
    version: string;
    requiredSections: ModeOutputSection[];
    requiredFields: string[];
  };
  toolRouting: {
    passiveTools: string[];
    actionTools: string[];
  };
  evaluationSuiteId: string;
  safetyBoundary: string;
};

export type ModeEvidenceSelection = {
  findings: CanonicalFinding[];
  diagnostics: {
    inputFindingCount: number;
    selectedFindingCount: number;
    strictMatchCount: number;
    fallbackApplied: boolean;
    promotionalExcludedCount: number;
    qualityExcludedCount: number;
    excludedClassCount: number;
    evidenceClassCounts: Record<string, number>;
    voiceCounts: Record<string, number>;
  };
};

export type ModeAnalysisResult = {
  modeId: AiAgentId;
  modeLabel: string;
  profileVersion: string;
  therapeuticArea: string;
  evaluationSuiteId: string;
  outputContract: {
    id: string;
    version: string;
  };
  evidenceSelection: ModeEvidenceSelection["diagnostics"];
  taxonomySignals: Array<{
    conceptId: string;
    label: string;
    dimension: string;
    findingCount: number;
    findingIds: string[];
  }>;
  sections: Array<{
    id: string;
    title: string;
    summary: string;
    evidenceFindingIds: string[];
  }>;
  routedTools: string[];
  limitations: string[];
  safetyBoundary: string;
};

const directVoices: EvidenceClass[] = [
  "patient_conversation",
  "caregiver_conversation",
  "provider_conversation",
  "community_conversation",
  "forum",
  "youtube_review",
  "personal_blog",
];

const authoritativeEvidence: EvidenceClass[] = [
  "research_journal",
  "clinical_study",
  "medical_society",
  "government_or_regulator",
  "healthcare_trade_publication",
  "healthcare_news",
];

const marketContext: EvidenceClass[] = [
  "consumer_news",
  "corporate_pr",
  "advocacy_organization",
  "event_or_conference",
  "podcast",
];

const commercialEvidence: EvidenceClass[] = [
  "corporate_pr",
  "clinic_marketing",
  "retail_or_product",
  "sponsored_content",
  "influencer_content",
];

const section = (
  id: string,
  title: string,
  purpose: string
): ModeOutputSection => ({ id, title, purpose });

const concept = (
  id: string,
  label: string,
  dimension: string,
  keywords: string[]
): ModeTaxonomyConcept => ({ id, label, dimension, keywords });

export const MODE_ANALYSIS_PROFILES: ModeAnalysisProfile[] = [
  {
    modeId: "scientific_intelligence_advisor",
    label: "Scientific Intelligence",
    version: "2.0.0",
    moduleIds: ["medical_affairs"],
    analysisInstructions: [
      "Separate scientific claims, professional interpretation, and public perception.",
      "Prioritize independently supported research and provider evidence over promotional repetition.",
      "Identify evidence gaps, contested claims, and questions requiring medical validation.",
      "Do not translate social prevalence into clinical validity.",
    ],
    evidencePolicy: {
      preferredEvidenceClasses: [...authoritativeEvidence, "provider_conversation"],
      admissibleEvidenceClasses: [...authoritativeEvidence, ...directVoices, ...marketContext],
      excludedEvidenceClasses: ["retail_or_product", "sponsored_content", "influencer_content"],
      preferredVoices: ["researcher", "provider", "patient"],
      minimumQualityScore: 35,
      promotionalHandling: "exclude",
      minimumRetainedFindings: 12,
    },
    taxonomy: [
      concept("scientific_claim", "Scientific claims", "evidence", ["study", "evidence", "data", "results", "efficacy"]),
      concept("mechanism", "Mechanism of action", "science", ["mechanism", "pathway", "biology", "biologic", "collagen"]),
      concept("safety", "Safety and tolerability", "evidence", ["safety", "adverse", "risk", "side effect", "tolerability"]),
      concept("evidence_gap", "Evidence gaps", "evidence", ["unknown", "unclear", "limited evidence", "more research", "question"]),
      concept("misinformation", "Scientific misinformation", "risk", ["myth", "misinformation", "false", "misleading", "unproven"]),
    ],
    outputContract: {
      id: "scientific_intelligence_analysis",
      version: "1.0.0",
      requiredSections: [
        section("scientific_perception", "Scientific perception", "How scientific claims are being interpreted."),
        section("evidence_quality", "Evidence quality", "Strength, independence, and limitations of support."),
        section("evidence_gaps", "Evidence gaps and questions", "Unsupported or unresolved scientific questions."),
        section("medical_implications", "Medical implications", "Evidence-bounded implications for Medical Affairs."),
      ],
      requiredFields: ["summary", "evidenceFindingIds", "limitations"],
    },
    toolRouting: {
      passiveTools: ["unified_search", "knowledge_graph", "evidence_reasoning"],
      actionTools: ["report_export", "persistent_monitor"],
    },
    evaluationSuiteId: "scientific_intelligence_therapeutic_area_v1",
    safetyBoundary: "Scientific interpretation is not a substitute for clinical, regulatory, or medical review.",
  },
  {
    modeId: "clinical_trial_companion",
    label: "Clinical Trials Intelligence",
    version: "2.0.0",
    moduleIds: ["clinical_trials"],
    analysisInstructions: [
      "Interpret social evidence through recruitment, participation, protocol, site, and retention lenses.",
      "Separate lived-experience barriers from formal eligibility requirements.",
      "Use trial records as authoritative for protocol facts and social data for experience signals.",
      "Never infer eligibility or recommend enrollment from social content alone.",
    ],
    evidencePolicy: {
      preferredEvidenceClasses: ["clinical_study", "patient_conversation", "caregiver_conversation", "provider_conversation"],
      admissibleEvidenceClasses: [...authoritativeEvidence, ...directVoices, "advocacy_organization", "healthcare_news"],
      excludedEvidenceClasses: [...commercialEvidence],
      preferredVoices: ["patient", "caregiver", "provider", "researcher"],
      minimumQualityScore: 30,
      promotionalHandling: "exclude",
      minimumRetainedFindings: 10,
    },
    taxonomy: [
      concept("recruitment", "Recruitment barriers", "trial_operations", ["recruit", "enroll", "eligibility", "qualify", "screening"]),
      concept("protocol_burden", "Protocol burden", "participant_experience", ["visit", "appointment", "procedure", "burden", "travel"]),
      concept("retention", "Retention risks", "trial_operations", ["dropout", "withdraw", "retention", "continue", "complete"]),
      concept("site", "Site and investigator experience", "trial_delivery", ["site", "investigator", "coordinator", "clinic", "center"]),
      concept("participant_experience", "Participant experience", "participant_experience", ["participant", "experience", "trial", "study", "research"]),
    ],
    outputContract: {
      id: "clinical_trial_social_intelligence_analysis",
      version: "1.0.0",
      requiredSections: [
        section("participation_signals", "Participation signals", "Observed interest, concerns, and expectations."),
        section("recruitment_retention", "Recruitment and retention barriers", "Evidence-backed operational barriers."),
        section("protocol_site", "Protocol and site experience", "Burden associated with visits, procedures, sites, and investigators."),
        section("trial_optimization", "Trial optimization considerations", "Non-clinical opportunities requiring operational review."),
      ],
      requiredFields: ["summary", "evidenceFindingIds", "limitations"],
    },
    toolRouting: {
      passiveTools: ["unified_search", "trial_registry", "knowledge_graph", "evidence_reasoning"],
      actionTools: [],
    },
    evaluationSuiteId: "clinical_trials_therapeutic_area_v1",
    safetyBoundary: "The mode must not determine individual eligibility or replace an investigator or trial-site decision.",
  },
  {
    modeId: "patient_journey_advisor",
    label: "Patient Journey",
    version: "2.0.0",
    moduleIds: ["patient"],
    analysisInstructions: [
      "Center patient and caregiver voices while distinguishing them from media and promotional narratives.",
      "Map signals to journey stages, barriers, emotional burden, adherence, switching, and unmet needs.",
      "Preserve differences across markets, platforms, and populations.",
      "Do not generalize isolated experiences to the full patient population.",
    ],
    evidencePolicy: {
      preferredEvidenceClasses: ["patient_conversation", "caregiver_conversation", "community_conversation", "forum", "youtube_review", "personal_blog"],
      admissibleEvidenceClasses: [...directVoices, "advocacy_organization", "provider_conversation", "healthcare_news"],
      excludedEvidenceClasses: [...commercialEvidence],
      preferredVoices: ["patient", "caregiver", "community", "provider"],
      minimumQualityScore: 20,
      promotionalHandling: "exclude",
      minimumRetainedFindings: 10,
    },
    taxonomy: [
      concept("awareness_diagnosis", "Awareness and diagnosis", "journey_stage", ["symptom", "diagnosis", "diagnosed", "doctor", "test"]),
      concept("treatment_access", "Treatment and access", "journey_stage", ["treatment", "access", "cost", "insurance", "available"]),
      concept("adherence_switching", "Adherence and switching", "journey_stage", ["adherence", "missed", "stopped", "switch", "discontinue"]),
      concept("emotional_burden", "Emotional burden", "experience", ["anxiety", "fear", "frustrated", "worried", "confidence"]),
      concept("quality_of_life", "Quality of life", "experience", ["quality of life", "daily", "work", "sleep", "relationship"]),
      concept("unmet_need", "Unmet needs", "outcome", ["need", "wish", "lack", "barrier", "help"]),
    ],
    outputContract: {
      id: "patient_journey_social_intelligence_analysis",
      version: "1.0.0",
      requiredSections: [
        section("journey_map", "Journey-stage signals", "Signals organized across the patient journey."),
        section("barriers_burden", "Barriers and burden", "Treatment, access, emotional, and quality-of-life burdens."),
        section("unmet_needs", "Unmet needs", "Needs supported by direct audience evidence."),
        section("patient_actions", "Patient-intelligence actions", "Evidence-bounded research or engagement actions."),
      ],
      requiredFields: ["summary", "evidenceFindingIds", "limitations"],
    },
    toolRouting: {
      passiveTools: ["unified_search", "knowledge_graph", "signal_monitoring"],
      actionTools: [],
    },
    evaluationSuiteId: "patient_journey_therapeutic_area_v1",
    safetyBoundary: "Lived-experience signals are descriptive and must not be presented as medical advice or population prevalence without support.",
  },
  {
    modeId: "congress_intelligence_advisor",
    label: "Congress Intelligence",
    version: "2.0.0",
    moduleIds: ["medical_affairs"],
    analysisInstructions: [
      "Distinguish congress-originated evidence from downstream media and social amplification.",
      "Track scientific topics, expert interpretation, competitive presence, and unanswered questions.",
      "Treat event promotion as context, not scientific corroboration.",
      "Do not imply abstract or presentation findings are peer-reviewed unless the evidence establishes that status.",
    ],
    evidencePolicy: {
      preferredEvidenceClasses: ["event_or_conference", "research_journal", "clinical_study", "provider_conversation", "medical_society"],
      admissibleEvidenceClasses: [...authoritativeEvidence, "event_or_conference", "provider_conversation", "healthcare_news", "healthcare_trade_publication", "corporate_pr"],
      excludedEvidenceClasses: ["retail_or_product", "clinic_marketing", "sponsored_content", "influencer_content"],
      preferredVoices: ["researcher", "provider", "journalist", "corporate"],
      minimumQualityScore: 25,
      promotionalHandling: "context_only",
      minimumRetainedFindings: 8,
    },
    taxonomy: [
      concept("abstract_data", "Abstract and data releases", "scientific_program", ["abstract", "poster", "data", "results", "presentation"]),
      concept("expert_interpretation", "Expert interpretation", "stakeholder", ["expert", "investigator", "speaker", "faculty", "physician"]),
      concept("competitive_presence", "Competitive presence", "market", ["competitor", "pipeline", "brand", "company", "launch"]),
      concept("scientific_questions", "Scientific questions", "evidence", ["question", "debate", "unclear", "gap", "future research"]),
      concept("social_amplification", "Social amplification", "channel", ["social", "discussion", "reaction", "coverage", "shared"]),
    ],
    outputContract: {
      id: "congress_social_intelligence_analysis",
      version: "1.0.0",
      requiredSections: [
        section("scientific_program", "Scientific program signals", "Topics and evidence associated with congress content."),
        section("expert_reaction", "Expert and audience reaction", "Professional interpretation and social amplification."),
        section("competitive_activity", "Competitive activity", "Evidence-backed organizational presence and narratives."),
        section("post_congress_actions", "Post-congress actions", "Follow-up questions, monitoring, and evidence needs."),
      ],
      requiredFields: ["summary", "evidenceFindingIds", "limitations"],
    },
    toolRouting: {
      passiveTools: ["unified_search", "congress_content", "evidence_reasoning"],
      actionTools: ["report_export", "persistent_monitor"],
    },
    evaluationSuiteId: "congress_intelligence_therapeutic_area_v1",
    safetyBoundary: "Congress signals must retain publication-status and source limitations and must not be represented as established clinical conclusions.",
  },
  {
    modeId: "corporate_reputation_advisor",
    label: "Corporate Reputation",
    version: "2.0.0",
    moduleIds: ["corporate_affairs"],
    analysisInstructions: [
      "Separate company-originated narrative from independent stakeholder perception.",
      "Assess reputation, advocacy, policy, issue, and executive-visibility signals by stakeholder and market.",
      "Measure amplification and contradiction without treating reach as endorsement.",
      "Identify emerging issues conservatively and preserve source provenance.",
    ],
    evidencePolicy: {
      preferredEvidenceClasses: ["advocacy_organization", "consumer_news", "healthcare_news", "community_conversation", "provider_conversation", "corporate_pr"],
      admissibleEvidenceClasses: [...directVoices, ...authoritativeEvidence, ...marketContext, ...commercialEvidence],
      excludedEvidenceClasses: [],
      preferredVoices: ["advocacy", "journalist", "community", "provider", "corporate"],
      minimumQualityScore: 0,
      promotionalHandling: "context_only",
      minimumRetainedFindings: 12,
    },
    taxonomy: [
      concept("reputation", "Corporate reputation", "reputation", ["reputation", "trust", "credibility", "leadership", "responsibility"]),
      concept("stakeholder", "Stakeholder perception", "stakeholder", ["patient", "provider", "advocacy", "investor", "employee"]),
      concept("narrative", "Narrative dynamics", "communications", ["narrative", "message", "coverage", "story", "claim"]),
      concept("issues", "Issues and risk", "risk", ["issue", "controversy", "criticism", "risk", "concern"]),
      concept("executive_visibility", "Executive visibility", "leadership", ["ceo", "executive", "leadership", "spokesperson", "interview"]),
    ],
    outputContract: {
      id: "corporate_reputation_social_intelligence_analysis",
      version: "1.0.0",
      requiredSections: [
        section("narrative_landscape", "Narrative landscape", "Company and independent narratives with provenance."),
        section("stakeholder_perception", "Stakeholder perception", "Differences across relevant stakeholder groups."),
        section("issues_risks", "Issues and reputation risks", "Supported risk signals and contradictions."),
        section("communications_actions", "Communications considerations", "Evidence-bounded monitoring and response considerations."),
      ],
      requiredFields: ["summary", "evidenceFindingIds", "limitations"],
    },
    toolRouting: {
      passiveTools: ["unified_search", "knowledge_graph", "signal_monitoring"],
      actionTools: ["report_export", "persistent_monitor"],
    },
    evaluationSuiteId: "corporate_reputation_therapeutic_area_v1",
    safetyBoundary: "Reputation signals describe observed narratives and must not be presented as verified intent, misconduct, or legal conclusions.",
  },
  {
    modeId: "referral_navigator",
    label: "Referral Intelligence",
    version: "2.0.0",
    moduleIds: ["patient"],
    analysisInstructions: [
      "Identify evidence-backed access, referral, provider, center, geography, and navigation barriers.",
      "Separate perceived access from verified provider-directory or service-availability facts.",
      "Prioritize patient, caregiver, and provider evidence and retain market differences.",
      "Never recommend a specific provider solely from social commentary.",
    ],
    evidencePolicy: {
      preferredEvidenceClasses: ["patient_conversation", "caregiver_conversation", "provider_conversation", "community_conversation", "advocacy_organization"],
      admissibleEvidenceClasses: [...directVoices, "advocacy_organization", "government_or_regulator", "healthcare_news", "clinic_marketing"],
      excludedEvidenceClasses: ["retail_or_product", "sponsored_content", "influencer_content"],
      preferredVoices: ["patient", "caregiver", "provider", "advocacy", "community"],
      minimumQualityScore: 15,
      promotionalHandling: "context_only",
      minimumRetainedFindings: 10,
    },
    taxonomy: [
      concept("referral_trigger", "Referral triggers", "pathway", ["referral", "refer", "specialist", "consult", "second opinion"]),
      concept("access_barrier", "Access barriers", "access", ["access", "wait", "cost", "insurance", "distance"]),
      concept("provider_center", "Providers and centers", "network", ["provider", "doctor", "specialist", "center", "clinic"]),
      concept("geography", "Geographic variation", "market", ["country", "region", "city", "local", "travel"]),
      concept("navigation", "Navigation needs", "experience", ["navigate", "find", "where", "help", "information"]),
    ],
    outputContract: {
      id: "referral_social_intelligence_analysis",
      version: "1.0.0",
      requiredSections: [
        section("referral_pathway", "Referral-pathway signals", "Observed triggers and pathway transitions."),
        section("access_barriers", "Access barriers", "Supported financial, geographic, informational, and system barriers."),
        section("provider_center_signals", "Provider and center signals", "Perceptions separated from verified directory facts."),
        section("navigation_actions", "Navigation opportunities", "Evidence-bounded access and information opportunities."),
      ],
      requiredFields: ["summary", "evidenceFindingIds", "limitations"],
    },
    toolRouting: {
      passiveTools: ["unified_search", "provider_directory", "knowledge_graph"],
      actionTools: [],
    },
    evaluationSuiteId: "referral_intelligence_therapeutic_area_v1",
    safetyBoundary: "Referral intelligence must not rank or endorse providers without verified directory, credential, and availability evidence.",
  },
  {
    modeId: "medical_information_assistant",
    label: "Medical Information",
    version: "2.0.0",
    moduleIds: ["medical_affairs"],
    analysisInstructions: [
      "Identify recurring scientific and product questions, terminology gaps, and information needs.",
      "Separate questions and perceptions from approved medical facts.",
      "Prioritize provider, patient, research, regulator, and medical-society evidence.",
      "Require approved-content review before producing a response intended for external use.",
    ],
    evidencePolicy: {
      preferredEvidenceClasses: ["provider_conversation", "patient_conversation", "research_journal", "medical_society", "government_or_regulator"],
      admissibleEvidenceClasses: [...authoritativeEvidence, ...directVoices, "advocacy_organization", "healthcare_news"],
      excludedEvidenceClasses: [...commercialEvidence],
      preferredVoices: ["provider", "patient", "caregiver", "researcher"],
      minimumQualityScore: 30,
      promotionalHandling: "exclude",
      minimumRetainedFindings: 10,
    },
    taxonomy: [
      concept("scientific_question", "Scientific questions", "inquiry", ["question", "how", "why", "evidence", "study"]),
      concept("product_question", "Product questions", "inquiry", ["product", "treatment", "dose", "use", "works"]),
      concept("safety_question", "Safety questions", "inquiry", ["safe", "risk", "side effect", "adverse", "warning"]),
      concept("misinformation", "Misinformation and confusion", "information_gap", ["confused", "myth", "misinformation", "unclear", "true"]),
      concept("information_gap", "Information gaps", "information_gap", ["need information", "cannot find", "explain", "understand", "guidance"]),
    ],
    outputContract: {
      id: "medical_information_social_intelligence_analysis",
      version: "1.0.0",
      requiredSections: [
        section("inquiry_trends", "Inquiry trends", "Recurring scientific, product, and safety questions."),
        section("information_gaps", "Information gaps", "Confusion, terminology, and unmet information needs."),
        section("evidence_boundaries", "Evidence boundaries", "What is supported, perceived, or unresolved."),
        section("response_priorities", "Response priorities", "Topics for governed content or Medical Information review."),
      ],
      requiredFields: ["summary", "evidenceFindingIds", "limitations"],
    },
    toolRouting: {
      passiveTools: ["unified_search", "medical_information", "evidence_reasoning"],
      actionTools: ["report_export"],
    },
    evaluationSuiteId: "medical_information_therapeutic_area_v1",
    safetyBoundary: "Outputs are intelligence about information needs and are not approved medical responses or medical advice.",
  },
  {
    modeId: "pharmacovigilance_assistant",
    label: "Safety Intelligence",
    version: "2.0.0",
    moduleIds: ["medical_affairs"],
    analysisInstructions: [
      "Screen broadly for product, health-experience, reporter, and temporal information while preserving verbatim evidence.",
      "Do not make case-validity, seriousness, expectedness, or causality determinations.",
      "Keep promotional and low-trust sources in screening scope but label their provenance and limitations.",
      "Route potential records to governed human review and preserve audit and clock information.",
    ],
    evidencePolicy: {
      preferredEvidenceClasses: ["patient_conversation", "caregiver_conversation", "provider_conversation", "forum", "youtube_review", "personal_blog"],
      admissibleEvidenceClasses: [...directVoices, ...authoritativeEvidence, ...marketContext, ...commercialEvidence, "unknown"],
      excludedEvidenceClasses: [],
      preferredVoices: ["patient", "caregiver", "provider", "community", "unknown"],
      minimumQualityScore: 0,
      promotionalHandling: "screen_all",
      minimumRetainedFindings: 1,
    },
    taxonomy: [
      concept("product", "Product identification", "minimum_information", ["product", "brand", "drug", "treatment", "device"]),
      concept("health_experience", "Health experience", "minimum_information", ["symptom", "reaction", "event", "side effect", "problem"]),
      concept("reporter", "Reporter information", "minimum_information", ["patient", "doctor", "caregiver", "i had", "my"]),
      concept("patient", "Patient information", "minimum_information", ["patient", "age", "male", "female", "person"]),
      concept("timing", "Timing and awareness", "compliance", ["today", "yesterday", "after", "since", "date"]),
      concept("duplicate", "Potential duplicates", "workflow", ["same", "again", "duplicate", "repost", "shared"]),
    ],
    outputContract: {
      id: "pv_social_screening_intelligence",
      version: "1.0.0",
      requiredSections: [
        section("screening_scope", "Screening scope", "Evidence screened and source limitations."),
        section("potential_records", "Potential safety records", "Signals requiring human review without case determination."),
        section("minimum_information", "Minimum-information coverage", "Product, experience, reporter, and patient information observed."),
        section("workflow_routing", "Required workflow routing", "Human review, timing, transfer, and audit requirements."),
      ],
      requiredFields: ["summary", "evidenceFindingIds", "limitations"],
    },
    toolRouting: {
      passiveTools: ["unified_search", "evidence_reasoning"],
      actionTools: ["safety_triage"],
    },
    evaluationSuiteId: "pv_screening_therapeutic_area_v1",
    safetyBoundary: "All detected records are potential signals only and require authorized human PV review; no automated case determination is permitted.",
  },
];

export function getModeAnalysisProfile(
  modeId?: string | null
): ModeAnalysisProfile | null {
  if (!modeId || modeId === "general") return null;
  return MODE_ANALYSIS_PROFILES.find(
    (profile) => profile.modeId === modeId
  ) || null;
}

function evidenceIntelligence(
  finding: CanonicalFinding
): EvidenceIntelligence | undefined {
  return (
    finding as CanonicalFinding & {
      evidenceIntelligence?: EvidenceIntelligence;
    }
  ).evidenceIntelligence;
}

function increment(
  values: Record<string, number>,
  key?: string
) {
  const normalized = key || "unknown";
  values[normalized] = (values[normalized] || 0) + 1;
}

function evidencePriority(
  finding: CanonicalFinding,
  profile: ModeAnalysisProfile
) {
  const intelligence = evidenceIntelligence(finding);
  const evidenceClass = intelligence?.evidenceClass || "unknown";
  const voice = intelligence?.voice || "unknown";
  let score = Number(intelligence?.qualityScore || 0);
  if (profile.evidencePolicy.preferredEvidenceClasses.includes(evidenceClass)) score += 50;
  if (profile.evidencePolicy.preferredVoices.includes(voice)) score += 25;
  if (intelligence?.isAuthenticConversation) score += 15;
  if (intelligence?.isPromotional && profile.evidencePolicy.promotionalHandling === "context_only") score -= 20;
  return score;
}

export function applyModeEvidencePolicy(
  findings: CanonicalFinding[],
  profile: ModeAnalysisProfile
): ModeEvidenceSelection {
  const policy = profile.evidencePolicy;
  let promotionalExcludedCount = 0;
  let qualityExcludedCount = 0;
  let excludedClassCount = 0;

  const strict = findings.filter((finding) => {
    const intelligence = evidenceIntelligence(finding);
    const evidenceClass = intelligence?.evidenceClass || "unknown";
    if (policy.excludedEvidenceClasses.includes(evidenceClass)) {
      excludedClassCount += 1;
      return false;
    }
    if (
      policy.promotionalHandling === "exclude" &&
      intelligence?.isPromotional
    ) {
      promotionalExcludedCount += 1;
      return false;
    }
    if (Number(intelligence?.qualityScore || 0) < policy.minimumQualityScore) {
      qualityExcludedCount += 1;
      return false;
    }
    return policy.admissibleEvidenceClasses.includes(evidenceClass);
  });

  const fallbackApplied =
    strict.length < Math.min(policy.minimumRetainedFindings, findings.length);
  let selected = strict;
  if (fallbackApplied) {
    const alreadySelected = new Set(strict.map((finding) => finding.findingId));
    const supplemental = findings
      .filter((finding) => {
        if (alreadySelected.has(finding.findingId)) return false;
        const intelligence = evidenceIntelligence(finding);
        const evidenceClass = intelligence?.evidenceClass || "unknown";
        if (policy.excludedEvidenceClasses.includes(evidenceClass)) return false;
        if (policy.promotionalHandling === "exclude" && intelligence?.isPromotional) return false;
        return true;
      })
      .sort((first, second) =>
        evidencePriority(second, profile) - evidencePriority(first, profile)
      );
    selected = [
      ...strict,
      ...supplemental.slice(
        0,
        Math.max(0, policy.minimumRetainedFindings - strict.length)
      ),
    ];
  }

  const evidenceClassCounts: Record<string, number> = {};
  const voiceCounts: Record<string, number> = {};
  selected.forEach((finding) => {
    const intelligence = evidenceIntelligence(finding);
    increment(evidenceClassCounts, intelligence?.evidenceClass);
    increment(voiceCounts, intelligence?.voice);
  });

  return {
    findings: selected,
    diagnostics: {
      inputFindingCount: findings.length,
      selectedFindingCount: selected.length,
      strictMatchCount: strict.length,
      fallbackApplied,
      promotionalExcludedCount,
      qualityExcludedCount,
      excludedClassCount,
      evidenceClassCounts,
      voiceCounts,
    },
  };
}

function searchableText(finding: CanonicalFinding) {
  return [
    finding.canonicalClaim,
    finding.summary,
    finding.findingType,
    ...(finding.normalizedLabels || []),
    ...(finding.symptoms || []),
    ...(finding.treatments || []),
    ...(finding.intentLabels || []),
    ...(finding.evidence || []).map((item) => item.excerpt),
  ]
    .join(" ")
    .toLowerCase();
}

function buildTaxonomySignals(
  profile: ModeAnalysisProfile,
  findings: CanonicalFinding[]
) {
  return profile.taxonomy
    .map((item) => {
      const matching = findings.filter((finding) => {
        const text = searchableText(finding);
        return item.keywords.some((keyword) =>
          text.includes(keyword.toLowerCase())
        );
      });
      return {
        conceptId: item.id,
        label: item.label,
        dimension: item.dimension,
        findingCount: matching.length,
        findingIds: matching.slice(0, 12).map((finding) => finding.findingId),
      };
    })
    .sort((first, second) => second.findingCount - first.findingCount);
}

export function buildModeAnalysisResult(params: {
  profile: ModeAnalysisProfile;
  therapeuticArea: string;
  selection: ModeEvidenceSelection;
  themeSummary?: Array<{
    label?: string;
    percent?: number;
    prevalence?: { eligiblePercent?: number };
    representativeFindingIds?: string[];
  }>;
}): ModeAnalysisResult {
  const { profile, therapeuticArea, selection } = params;
  const taxonomySignals = buildTaxonomySignals(profile, selection.findings);
  const supportedSignals = taxonomySignals.filter((item) => item.findingCount > 0);
  const topThemes = (params.themeSummary || []).slice(0, 3);
  const topThemeSummary = topThemes.length
    ? topThemes
        .map((theme) => {
          const prevalence =
            theme.prevalence?.eligiblePercent ?? theme.percent;
          return `${theme.label || "Unnamed theme"}${
            typeof prevalence === "number" ? ` (${prevalence}%)` : ""
          }`;
        })
        .join(", ")
    : "No evidence-qualified themes met the current analytical threshold";

  const sections = profile.outputContract.requiredSections.map(
    (requiredSection, index) => {
      const signal = supportedSignals[index % Math.max(1, supportedSignals.length)];
      const evidenceFindingIds = signal?.findingIds ||
        topThemes.flatMap((theme) => theme.representativeFindingIds || []).slice(0, 8);
      const summary = signal
        ? `${signal.label} is represented in ${signal.findingCount} selected finding${
            signal.findingCount === 1 ? "" : "s"
          }. The leading evidence-qualified themes are ${topThemeSummary}. ${requiredSection.purpose}`
        : `${topThemeSummary}. ${requiredSection.purpose} Available evidence is insufficient for a more specific mode-level conclusion.`;
      return {
        id: requiredSection.id,
        title: requiredSection.title,
        summary,
        evidenceFindingIds,
      };
    }
  );

  const limitations = [
    selection.diagnostics.fallbackApplied
      ? "The strict mode evidence policy produced limited coverage, so the analysis added the highest-priority admissible evidence and retained that fallback in diagnostics."
      : "The strict mode evidence policy supplied sufficient qualifying evidence.",
    supportedSignals.length
      ? `${supportedSignals.length} of ${profile.taxonomy.length} domain-taxonomy concepts were observed in the selected evidence.`
      : "No configured domain-taxonomy concept had direct keyword support in the selected evidence.",
    profile.safetyBoundary,
  ];

  return {
    modeId: profile.modeId,
    modeLabel: profile.label,
    profileVersion: profile.version,
    therapeuticArea,
    evaluationSuiteId: profile.evaluationSuiteId,
    outputContract: {
      id: profile.outputContract.id,
      version: profile.outputContract.version,
    },
    evidenceSelection: selection.diagnostics,
    taxonomySignals: supportedSignals.slice(0, 8),
    sections,
    routedTools: profile.toolRouting.passiveTools,
    limitations,
    safetyBoundary: profile.safetyBoundary,
  };
}

export function formatModeAnalysisInstructions(
  profile: ModeAnalysisProfile,
  result?: ModeAnalysisResult | null
) {
  return [
    `INTELLIGENCE MODE: ${profile.label} (${profile.modeId}, profile ${profile.version})`,
    "MODE ANALYSIS INSTRUCTIONS:",
    ...profile.analysisInstructions.map((instruction) => `- ${instruction}`),
    "DOMAIN TAXONOMY:",
    ...profile.taxonomy.map(
      (item) => `- ${item.label} [${item.dimension}]: ${item.keywords.join(", ")}`
    ),
    "OUTPUT CONTRACT:",
    ...profile.outputContract.requiredSections.map(
      (item) => `- ${item.title}: ${item.purpose}`
    ),
    `EVIDENCE POLICY: minimum quality ${profile.evidencePolicy.minimumQualityScore}; promotional handling ${profile.evidencePolicy.promotionalHandling}; preferred voices ${profile.evidencePolicy.preferredVoices.join(", ")}.`,
    result
      ? `SELECTED EVIDENCE: ${result.evidenceSelection.selectedFindingCount} of ${result.evidenceSelection.inputFindingCount} findings; strict matches ${result.evidenceSelection.strictMatchCount}; fallback ${result.evidenceSelection.fallbackApplied ? "used" : "not used"}.`
      : "SELECTED EVIDENCE: Mode-specific analytical diagnostics are unavailable.",
    `SAFETY BOUNDARY: ${profile.safetyBoundary}`,
    "Apply this mode lens to the direct answer, strategic meaning, and recommended actions. Do not invent evidence or claim that a routed capability returned data unless that data appears in the supplied inputs.",
  ].join("\n");
}
