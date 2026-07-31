export const HYBRID_ANSWER_JSON_SCHEMA = {
  type: "object",
  properties: {
    directAnswer: {
      type: "string",
    },
    curatedIntelligence: {
      type: "object",
      properties: {
        themes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
              },
              description: {
                type: "string",
              },
            },
            required: [
              "name",
              "description",
            ],
            additionalProperties:
              false,
          },
        },
      },
      required: ["themes"],
      additionalProperties: false,
    },
    liveData: {
      type: "object",
      properties: {
        themes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
              },
              description: {
                type: "string",
              },
              sourceType: {
                type: "string",
              },
              relationship: {
                type: "string",
              },
            },
            required: [
              "name",
              "description",
              "sourceType",
              "relationship",
            ],
            additionalProperties:
              false,
          },
        },
        emergingNarratives: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: [
        "themes",
        "emergingNarratives",
      ],
      additionalProperties: false,
    },
    whatThisMeans: {
      type: "string",
    },
    recommendedActions: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },
  required: [
    "directAnswer",
    "curatedIntelligence",
    "liveData",
    "whatThisMeans",
    "recommendedActions",
  ],
  additionalProperties: false,
};

export const CURATED_THEMES_JSON_SCHEMA = {
  type: "object",
  properties: {
    themes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          theme_name: {
            type: "string",
          },
          theme_description: {
            type: "string",
          },
          report_excerpt: {
            type: "string",
          },
          report_section: {
            type: "string",
          },
        },
        required: [
          "theme_name",
          "theme_description",
          "report_excerpt",
          "report_section",
        ],
        additionalProperties:
          false,
      },
    },
  },
  required: ["themes"],
  additionalProperties: false,
};

export const NOISE_THEMES_JSON_SCHEMA = {
  type: "object",
  properties: {
    themes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          theme_name: {
            type: "string",
          },
          theme_description: {
            type: "string",
          },
          mention_count: {
            type: "number",
          },
          confidence: {
            type: "number",
          },
          example_mentions: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        required: [
          "theme_name",
          "theme_description",
          "mention_count",
          "confidence",
          "example_mentions",
        ],
        additionalProperties:
          false,
      },
    },
  },
  required: ["themes"],
  additionalProperties: false,
};

export const THEME_MATCH_JSON_SCHEMA = {
  type: "object",
  properties: {
    relationship: {
      type: "string",
      enum: [
        "covered",
        "partial",
        "emerging",
      ],
    },
    rationale: {
      type: "string",
    },
    confidence: {
      type: "number",
    },
  },
  required: [
    "relationship",
    "rationale",
    "confidence",
  ],
  additionalProperties: false,
};

export const EVIDENCE_BACKED_ANSWER_JSON_SCHEMA = {
  type: "object",
  properties: {
    answer: {
      type: "string",
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: {
            type: "string",
          },
          confidence: {
            type: "number",
          },
          evidenceIds: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        required: [
          "text",
          "confidence",
          "evidenceIds",
        ],
        additionalProperties:
          false,
      },
    },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          evidenceId: {
            type: "string",
          },
          sourceId: {
            type: "string",
          },
          title: {
            type: "string",
          },
          sourceType: {
            type: "string",
          },
          excerpt: {
            type: [
              "string",
              "null",
            ],
          },
          url: {
            type: [
              "string",
              "null",
            ],
          },
          publishedAt: {
            type: [
              "string",
              "null",
            ],
          },
        },
        required: [
          "evidenceId",
          "sourceId",
          "title",
          "sourceType",
          "excerpt",
          "url",
          "publishedAt",
        ],
        additionalProperties:
          false,
      },
    },
    limitations: {
      type: "array",
      items: {
        type: "string",
      },
    },
    generatedAt: {
      type: "string",
    },
    statements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [
              "source_fact",
              "extracted_claim",
              "ai_inference",
              "recommended_action",
            ],
          },
          text: {
            type: "string",
          },
          confidence: {
            type: [
              "number",
              "null",
            ],
          },
          evidenceIds: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        required: [
          "kind",
          "text",
          "confidence",
          "evidenceIds",
        ],
        additionalProperties:
          false,
      },
    },
  },
  required: [
    "answer",
    "claims",
    "citations",
    "limitations",
    "generatedAt",
    "statements",
  ],
  additionalProperties: false,
};
