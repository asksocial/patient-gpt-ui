import { DiseaseProfile } from "./types";

export const medicalAestheticsProfile: DiseaseProfile = {
  profileId: "medical_aesthetics",
  therapeuticArea: "Medical Aesthetics",

  diseaseNames: [
    "medical aesthetics",
    "aesthetic medicine",
    "cosmetic dermatology",
    "injectables",
    "facial aesthetics",
    "regenerative aesthetics"
  ],

  symptomPatterns: {
    "filler concerns": [
      "filler migration",
      "pillow face",
      "overfilled",
      "filler regret",
      "getting it dissolved",
      "filler fatigue"
    ],
    "glp1 facial changes": [
      "Ozempic face",
      "Mounjaro face",
      "Wegovy face",
      "look gaunt",
      "lost all my volume",
      "weight loss aged me",
      "look sick",
      "sagging after weight loss"
    ],
    "skin quality concerns": [
      "skin quality",
      "skin health",
      "glow from within",
      "skin booster",
      "injectable moisturizer"
    ],
    "safety concerns": [
      "is this safe",
      "reaction after",
      "side effect",
      "swelling",
      "lump",
      "vision change",
      "ended up in the ER"
    ]
  },

  treatmentPatterns: {
    toxins: [
      "Botox",
      "Dysport",
      "Xeomin",
      "Jeuveau",
      "Daxxify",
      "Boey",
      "TrenibotE",
      "trenibotulinumtoxinE",
      "short duration toxin"
    ],
    fillers: [
      "Juvederm",
      "Restylane",
      "RHA",
      "Belotero",
      "Radiesse",
      "Sculptra",
      "hyaluronidase",
      "dermal filler",
      "lip filler",
      "cheek filler"
    ],
    "skin quality treatments": [
      "Skinvive",
      "microtoxin",
      "skin booster",
      "injectable moisturizer",
      "intradermal skin quality"
    ],
    regenerative: [
      "exosome facial",
      "exosomes",
      "exosome treatment",
      "regenerative aesthetics",
      "PRP",
      "PRF"
    ],
    peptides: [
      "BPC-157",
      "TB-500",
      "MOTS-C",
      "KPV",
      "Semax",
      "Epitalon",
      "DSIP"
    ],
    "biological age": [
      "skin age test",
      "epigenetic skin test",
      "Mitra Bio",
      "biological age skin",
      "skin aging clock"
    ]
  },

  burdenTerms: [
    "regret",
    "fear",
    "anxiety",
    "confused",
    "unsafe",
    "fake",
    "counterfeit",
    "permanent",
    "expensive",
    "botched",
    "overdone",
    "unnatural",
    "complication",
    "downtime",
    "pain",
    "swelling",
    "bruising"
  ],

  patientIndicators: [
    "I want",
    "I'm thinking about",
    "I got",
    "I had",
    "my filler",
    "my Botox",
    "my face",
    "should I",
    "has anyone",
    "is it safe",
    "what if I don't like it",
    "can I undo"
  ],

  educationalExclusionPatterns: [
    "training course",
    "certification",
    "webinar",
    "conference",
    "masterclass"
  ],

  lowQualityNoisePatterns: [
    "book now",
    "limited time offer",
    "link in bio",
    "DM to book",
    "sale",
    "discount",
    "call today"
  ],

  hardExclusionPatterns: [
    "job opening",
    "now hiring",
    "aesthetic nurse job",
    "injector training"
  ],

  requirePatientVoice: false,
  requireDiseaseContextForSymptoms: false,

  brands: [
    "Botox",
    "Dysport",
    "Xeomin",
    "Jeuveau",
    "Daxxify",
    "Juvederm",
    "Restylane",
    "RHA",
    "Belotero",
    "Radiesse",
    "Sculptra",
    "Skinvive",
    "CoolSculpting",
    "Morpheus8",
    "Emsculpt",
    "Thermage",
    "Ultherapy",
    "Allergan Aesthetics",
    "Galderma",
    "Revance",
    "Merz"
  ],

  procedures: [
    "Botox",
    "Neuromodulators",
    "Dermal Fillers",
    "Lip Filler",
    "Cheek Filler",
    "Jawline Filler",
    "Skin Booster",
    "PRP",
    "PRF",
    "Exosomes",
    "Microneedling",
    "RF Microneedling",
    "Laser Resurfacing",
    "IPL",
    "Chemical Peel",
    "Body Contouring",
    "Regenerative Aesthetics"
  ],

  journeyStages: [
    "Awareness",
    "Considering Treatment",
    "Provider Selection",
    "Consultation",
    "Treatment Decision",
    "Procedure Day",
    "Recovery",
    "Follow-up",
    "Maintenance",
    "Complication"
  ],

  emotions: [
    "Trust",
    "Fear",
    "Hope",
    "Regret",
    "Confusion",
    "Excitement",
    "Confidence",
    "Anxiety",
    "Frustration",
    "Skepticism"
  ],

  knowledgeDomains: [
    {
      id: "reversibility",
      name: "Duration & Reversibility",
      type: "Market Theme",
      description:
        "Consumers seeking short-duration or reversible injectable options before committing.",
      signalPhrases: [
        "want to try it first",
        "what if I don't like it",
        "can I undo Botox",
        "is it permanent",
        "first time getting tox",
        "buyer's remorse"
      ],
      keywords: [
        "Boey",
        "TrenibotE",
        "trenibotulinumtoxinE",
        "short duration toxin",
        "2-3 week Botox",
        "first-time tox"
      ]
    },
    {
      id: "skin-quality",
      name: "Skin Quality",
      type: "Market Theme",
      description:
        "Patients thinking in terms of skin quality and skin health rather than skincare versus procedure.",
      signalPhrases: [
        "skin quality",
        "skin health",
        "glow from within",
        "is this skincare or a treatment",
        "skin booster"
      ],
      keywords: [
        "microtoxin",
        "skin booster",
        "injectable moisturizer",
        "Skinvive",
        "intradermal skin quality",
        "at-home regenerative serum"
      ]
    },
    {
      id: "filler-trust",
      name: "Filler Trust Crisis",
      type: "Market Theme",
      description:
        "Fear and skepticism around filler migration, overfilled appearance, regret and dissolving.",
      signalPhrases: [
        "filler migration",
        "pillow face",
        "overfilled",
        "filler regret",
        "getting it dissolved",
        "filler fatigue"
      ],
      keywords: [
        "filler migration",
        "dissolve filler",
        "hyaluronidase",
        "overfilled face",
        "filler gone wrong",
        "filler regret"
      ]
    },
    {
      id: "glp1-facial-changes",
      name: "GLP-1 Facial Changes",
      type: "Market Theme",
      description:
        "Facial volume loss and aging concerns among GLP-1 weight-loss patients.",
      signalPhrases: [
        "Ozempic face",
        "look gaunt",
        "lost all my volume",
        "weight loss aged me",
        "look sick",
        "is this permanent"
      ],
      keywords: [
        "Ozempic face",
        "GLP-1 facial volume loss",
        "Mounjaro face",
        "gaunt after weight loss",
        "Wegovy face",
        "sagging after weight loss"
      ]
    },
    {
      id: "regenerative-trust",
      name: "Regenerative Trust Reckoning",
      type: "Market Theme",
      description:
        "Trust, legality and safety questions around exosomes and regenerative aesthetics.",
      signalPhrases: [
        "is this legal",
        "are exosomes FDA approved",
        "is this safe",
        "provider liability",
        "what's actually in it"
      ],
      keywords: [
        "exosome facial",
        "exosomes FDA approved",
        "are exosomes legal",
        "exosome treatment safe",
        "exosome enforcement",
        "regenerative aesthetics"
      ]
    },
    {
      id: "peptides",
      name: "Peptides",
      type: "Market Theme",
      description:
        "Questions around legal access, compounding and credibility of aesthetic peptides.",
      signalPhrases: [
        "are peptides legal now",
        "legal to compound",
        "is it proven",
        "approved peptide",
        "where to buy peptides"
      ],
      keywords: [
        "BPC-157",
        "TB-500",
        "MOTS-C",
        "Semax",
        "Epitalon",
        "DSIP",
        "peptide compounding 503A"
      ]
    },
    {
      id: "biological-age",
      name: "Biological Age",
      type: "Market Theme",
      description:
        "Consumers asking about skin age, biological age, glycation and cellular aging.",
      signalPhrases: [
        "how old is my skin",
        "skin age",
        "biological age",
        "can I reverse my skin age",
        "glycation",
        "cellular aging"
      ],
      keywords: [
        "skin age test",
        "epigenetic skin test",
        "Mitra Bio",
        "biological age skin",
        "skin aging clock",
        "longevity skincare"
      ]
    },
    {
      id: "counterfeit-safety",
      name: "Authenticity & Counterfeit Safety",
      type: "Market Theme",
      description:
        "Fear around counterfeit injectables, grey market products and product authenticity.",
      signalPhrases: [
        "is this real",
        "is it genuine",
        "where is it made",
        "fake filler",
        "counterfeit Botox",
        "how do I know it's legit"
      ],
      keywords: [
        "counterfeit Botox",
        "fake filler",
        "is my filler real",
        "cross-border injectables",
        "verify product authenticity",
        "grey market botulinum"
      ]
    },
    {
      id: "safety-surveillance",
      name: "Safety Surveillance",
      type: "Market Theme",
      description:
        "Patient-reported complications and adverse event language appearing in social conversations.",
      signalPhrases: [
        "reaction after",
        "complication",
        "side effect",
        "ended up in the ER",
        "swelling",
        "lump",
        "vision change"
      ],
      keywords: [
        "filler nodule",
        "vascular occlusion filler",
        "blindness filler",
        "lump after",
        "product side effect"
      ]
    },
    {
      id: "natural-results",
      name: "Natural Results",
      type: "Market Theme",
      description:
        "Preference for subtle, undetectable results rather than exaggerated aesthetic work.",
      signalPhrases: [
        "look like myself",
        "no one knew",
        "natural results",
        "not overdone",
        "looks done",
        "subtle"
      ],
      keywords: [
        "natural tweakments",
        "undetectable work",
        "subtle filler",
        "looks like myself",
        "no one can tell",
        "overdone look"
      ]
    }
  ]
};