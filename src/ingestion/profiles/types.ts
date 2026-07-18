export interface ListeningDomain {
  id: string;
  name: string;
  type: string;

  description?: string;

  signalPhrases?: string[];
  keywords?: string[];
}

export interface DiseaseProfile {
  /**
   * Internal profile identifier
   * Example: hepatitis_b
   */
  profileId: string;

  /**
   * Human-readable therapeutic area
   */
  therapeuticArea: string;

  /**
   * Disease names, abbreviations and aliases
   */
  diseaseNames: string[];

  /**
   * Maps symptom category -> keywords
   */
  symptomPatterns: Record<string, string[]>;

  /**
   * Maps treatment category -> keywords
   */
  treatmentPatterns?: Record<string, string[]>;

  /**
   * Burden / quality-of-life language
   */
  burdenTerms: string[];

  /**
   * Patient and caregiver indicators
   */
  patientIndicators?: string[];
  caregiverIndicators?: string[];

  /**
   * Noise filtering
   */
  educationalExclusionPatterns?: string[];
  lowQualityNoisePatterns?: string[];

  hardExclusionPatterns?: string[];
  extraExclusionPatterns?: string[];

  /**
   * Ingestion rules
   */
  requirePatientVoice?: boolean;
  requireDiseaseContextForSymptoms?: boolean;

  /**
   * ---------- NEW OPTIONAL FIELDS ----------
   * Used by richer therapeutic-area profiles
   */

  knowledgeDomains?: ListeningDomain[];

  brands?: string[];

  procedures?: string[];

  journeyStages?: string[];

  emotions?: string[];

  /**
   * Vaccine-specific profiles
   * (Used by Hep B template)
   */

  vaccineContextPatterns?: string[];

  vaccineCausalityPatterns?: string[];

  /**
   * Future expansion
   */

  biomarkers?: string[];

  diagnostics?: string[];

  proceduresOfCare?: string[];

  medications?: string[];

  adverseEventPatterns?: Record<string, string[]>;

  marketThemes?: string[];
}