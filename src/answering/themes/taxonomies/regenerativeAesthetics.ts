import type {
  EvidenceClass,
} from "../../evidence/types";
import type {
  ThemeTaxonomy,
} from "../themeModels";

const EXCLUDED_PROMOTIONAL_CLASSES:
  EvidenceClass[] = [
    "corporate_pr",
    "clinic_marketing",
    "retail_or_product",
    "sponsored_content",
    "influencer_content",
    "unknown",
  ];

const SOCIAL_RECOVERY_CLASSES:
  EvidenceClass[] = [
    "patient_conversation",
    "caregiver_conversation",
    "provider_conversation",
    "community_conversation",
    "youtube_review",
    "forum",
    "podcast",
    "personal_blog",
  ];

const AUTHORITATIVE_CLASSES:
  EvidenceClass[] = [
    "research_journal",
    "clinical_study",
    "government_or_regulator",
    "medical_society",
    "advocacy_organization",
    "healthcare_trade_publication",
    "healthcare_news",
  ];

export const regenerativeAestheticsThemeTaxonomy: ThemeTaxonomy =
  {
    therapeuticArea:
      "regenerative_aesthetics",

    themes: [
      {
        themeId:
          "preventative_aesthetics",

        label:
          "Preventative Aesthetics",

        description:
          "Interest in starting earlier to preserve skin quality and delay visible aging.",

        keywords: [
          "preventative",
          "preventive",
          "early intervention",
          "start younger",
          "younger consumers",
          "younger demographic",
          "delay visible aging",
          "preserve skin",
        ],

        preferredEvidenceClasses: [
          "patient_conversation",
          "provider_conversation",
          "community_conversation",
          "research_journal",
          "clinical_study",
          "healthcare_trade_publication",
          "healthcare_news",
        ],

        allowedEvidenceClasses: [
          ...SOCIAL_RECOVERY_CLASSES,
          ...AUTHORITATIVE_CLASSES,
          "consumer_news",
        ],

        excludedEvidenceClasses: [
          ...EXCLUDED_PROMOTIONAL_CLASSES,
        ],
      },

      {
        themeId:
          "natural_results",

        label:
          "Natural-Looking Results",

        description:
          "Demand for subtle, refreshed outcomes rather than overfilled or obvious cosmetic work.",

        keywords: [
          "natural results",
          "natural-looking",
          "natural looking",
          "subtle results",
          "subtle outcome",
          "not overfilled",
          "refreshed",
          "authentic results",
          "balanced results",
        ],

        preferredEvidenceClasses: [
          "patient_conversation",
          "provider_conversation",
          "community_conversation",
          "youtube_review",
          "research_journal",
          "clinical_study",
        ],

        allowedEvidenceClasses: [
          ...SOCIAL_RECOVERY_CLASSES,
          ...AUTHORITATIVE_CLASSES,
        ],

        excludedEvidenceClasses: [
          ...EXCLUDED_PROMOTIONAL_CLASSES,
          "consumer_news",
        ],
      },

      {
        themeId:
          "skin_quality_over_volume",

        label:
          "Skin Quality Over Volume",

        description:
          "Shift from volume correction toward skin quality, texture, elasticity, firmness, and tissue health.",

        keywords: [
          "skin quality",
          "quality of skin",
          "texture",
          "elasticity",
          "firmness",
          "not volume",
          "over volume",
          "less volume",
          "skin health",
          "tissue health",
          "healthy skin",
        ],

        preferredEvidenceClasses: [
          "patient_conversation",
          "provider_conversation",
          "community_conversation",
          "research_journal",
          "clinical_study",
          "youtube_review",
        ],

        allowedEvidenceClasses: [
          ...SOCIAL_RECOVERY_CLASSES,
          ...AUTHORITATIVE_CLASSES,
        ],

        excludedEvidenceClasses: [
          ...EXCLUDED_PROMOTIONAL_CLASSES,
          "consumer_news",
        ],
      },

      {
        themeId:
          "collagen_biostimulation",

        label:
          "Collagen Biostimulation",

        description:
          "Interest in treatments that stimulate collagen or gradually rebuild tissue.",

        keywords: [
          "collagen",
          "collagen stimulation",
          "collagen production",
          "biostimulation",
          "biostimulator",
          "biostimulators",
          "sculptra",
          "radiesse",
          "gradual results",
          "rebuild tissue",
        ],

        preferredEvidenceClasses: [
          "patient_conversation",
          "provider_conversation",
          "community_conversation",
          "research_journal",
          "clinical_study",
        ],

        allowedEvidenceClasses: [
          ...SOCIAL_RECOVERY_CLASSES,
          ...AUTHORITATIVE_CLASSES,
        ],

        excludedEvidenceClasses: [
          ...EXCLUDED_PROMOTIONAL_CLASSES,
          "consumer_news",
        ],
      },

      {
        themeId:
          "regenerative_biology",

        label:
          "Regenerative Biology",

        description:
          "Interest in regenerative science, exosomes, PRP, PRF, PDRN, polynucleotides, and tissue regeneration.",

        keywords: [
          "regenerative biology",
          "regenerative medicine",
          "regenerative aesthetics",
          "exosomes",
          "prp",
          "prf",
          "pdrn",
          "polynucleotides",
          "tissue regeneration",
          "growth factors",
          "cellular repair",
        ],

        preferredEvidenceClasses: [
          "patient_conversation",
          "provider_conversation",
          "community_conversation",
          "research_journal",
          "clinical_study",
        ],

        allowedEvidenceClasses: [
          ...SOCIAL_RECOVERY_CLASSES,
          ...AUTHORITATIVE_CLASSES,
        ],

        excludedEvidenceClasses: [
          ...EXCLUDED_PROMOTIONAL_CLASSES,
          "consumer_news",
        ],
      },

      {
        themeId:
          "provider_led_trust",

        label:
          "Provider-Led Trust",

        description:
          "Signals that clinicians, dermatologists, injectors, and physician-led care shape credibility and adoption.",

        keywords: [
          "doctor-led",
          "physician-led",
          "clinician-led",
          "provider-led",
          "dermatologist",
          "physician",
          "injector",
          "clinician",
          "medical aesthetics",
          "aesthetic medicine",
          "clinical expertise",
          "treatment planning",
          "patient selection",
        ],

        preferredEvidenceClasses: [
          "provider_conversation",
          "patient_conversation",
          "community_conversation",
          "research_journal",
          "clinical_study",
          "medical_society",
        ],

        allowedEvidenceClasses: [
          "provider_conversation",
          "patient_conversation",
          "caregiver_conversation",
          "community_conversation",
          "research_journal",
          "clinical_study",
          "medical_society",
          "government_or_regulator",
          "advocacy_organization",
          "healthcare_trade_publication",
          "healthcare_news",
          "youtube_review",
          "forum",
          "podcast",
        ],

        excludedEvidenceClasses: [
          ...EXCLUDED_PROMOTIONAL_CLASSES,
          "consumer_news",
          "event_or_conference",
        ],
      },
    ],
  };