export interface DiseaseProfile {
  profileId: string;
  therapeuticArea: string;

  diseaseNames: string[];

  symptomPatterns: Record<string, string[]>;
  treatmentPatterns?: Record<string, string[]>;

  burdenTerms: string[];

  patientIndicators?: string[];
  caregiverIndicators?: string[];

  educationalExclusionPatterns?: string[];
  lowQualityNoisePatterns?: string[];

  vaccineContextPatterns?: string[];
  vaccineCausalityPatterns?: string[];

  extraExclusionPatterns?: string[];

  // ✅ NEW
  hardExclusionPatterns?: string[];
  requirePatientVoice?: boolean;

  requireDiseaseContextForSymptoms?: boolean;
}