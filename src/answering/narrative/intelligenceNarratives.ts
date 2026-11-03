import { clientNarrative, topicNarrative } from "./clientNarrative";

type ModuleNarrativeInput = {
  moduleId: string;
  therapeuticArea: string;
  sections: Array<{ label: string; findingCount: number }>;
};

const MODULE_MEANING: Record<string, string> = {
  medical_affairs: "These discussions can help frame scientific communication and identify questions that may benefit from further clinical or health-outcomes research.",
  clinical_trials: "These discussions can help frame questions about study design and participant support. General treatment experiences provide context, while conclusions about trial participation require explicit research accounts.",
  corporate_affairs: "These discussions offer context for understanding stakeholder questions and planning communication that responds to the issues being raised.",
  commercial: "These discussions offer a starting point for exploring access, treatment considerations, and the information people seek when comparing options.",
  competitive: "These discussions can help focus further research into how treatment options and organizations are discussed, including questions that may warrant closer comparison.",
  advocacy: "These discussions can help identify areas where education, community support, or further engagement may be useful.",
};

export function moduleNarrative(input: ModuleNarrativeInput): string {
  return topicNarrative({
    themes: input.sections.filter(section => section.findingCount > 0).slice(0, 3).map(section => section.label),
    context: `about ${input.therapeuticArea}`,
    significance: MODULE_MEANING[input.moduleId] || "These themes can help focus further qualitative research and source review.",
    limitation: "The findings reflect the sources available for review; further analysis is needed to establish how widely these views are shared and how they relate to decisions or outcomes. Company-authored material, where included, provides context rather than independent confirmation.",
  });
}

type PatientNarrativeInput = {
  therapeuticArea: string;
  treatmentBarriers: Array<{ label: string; count: number }>;
  unmetNeeds: Array<{ label: string; count: number }>;
  emotionalBurden: Array<{ label: string; count: number }>;
  dataQuality: { evidenceScope: string };
};

export function patientNarrative(input: PatientNarrativeInput): string {
  const themes = [...input.treatmentBarriers, ...input.unmetNeeds, ...input.emotionalBurden]
    .filter(signal => signal.count > 0).slice(0, 3).map(signal => signal.label);
  return topicNarrative({
    themes,
    context: `about ${input.therapeuticArea}`,
    observations: input.dataQuality.evidenceScope === "patient_related"
      ? ["The material includes patient-related community and third-party discussion, so it should be read alongside direct patient and caregiver accounts."] : [],
    significance: "These accounts offer a starting point for understanding treatment experiences and identifying where clearer information or support may be useful.",
    limitation: "Further qualitative research is needed to establish how these experiences affect individual treatment decisions and continuity of care; the conversations do not establish clinical outcomes or population prevalence.",
  });
}

type ExecutiveNarrativeInput = {
  therapeuticArea: string;
  topThemes: Array<{ label: string; eligiblePercent: number }>;
  dataQuality: { temporalCoveragePercent: number };
};

export function executiveNarrative(input: ExecutiveNarrativeInput, observations: string[] = []): string {
  const themes = input.topThemes.filter(theme => theme.eligiblePercent > 0).slice(0, 3).map(theme => theme.label);
  const overview = topicNarrative({
    themes,
    context: `about ${input.therapeuticArea}`,
    significance: "Together, these themes provide a starting point for prioritizing further research and understanding the questions receiving attention in the available discussion.",
    limitation: "The findings describe the available sources rather than the wider population. Further review is needed to establish how these themes relate to treatment decisions or outcomes.",
    observations,
  });
  return clientNarrative({ opening: overview, limitation: themes.length && input.dataQuality.temporalCoveragePercent < 80 ? "Incomplete date coverage also limits conclusions about change over time." : "" });
}
