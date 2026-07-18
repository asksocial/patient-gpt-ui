import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import type {
  FindingTextDiagnostic,
  TextFieldDiagnostic,
} from "./types";

const MINIMUM_ANALYZABLE_TEXT_LENGTH =
  40;

const RICH_TEXT_LENGTH =
  140;

const STANDARD_TEXT_FIELDS = [
  "title",
  "summary",
  "excerpt",
  "description",
  "canonicalClaim",
  "text",
  "body",
  "content",
  "message",
  "postText",
  "originalText",
  "documentText",
  "snippet",
] as const;

const POSSIBLE_TEXT_FIELD_NAMES =
  new Set([
    "article",
    "articlebody",
    "articletext",
    "body",
    "bodytext",
    "caption",
    "comment",
    "content",
    "description",
    "document",
    "documenttext",
    "excerpt",
    "fulltext",
    "headline",
    "message",
    "originaltext",
    "post",
    "postcontent",
    "posttext",
    "snippet",
    "socialtext",
    "summary",
    "text",
    "title",
    "transcript",
  ]);

function normalizeWhitespace(
  value: string
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function stringValue(
  value: unknown
): string | undefined {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  if (
    typeof value === "string"
  ) {
    const normalized =
      normalizeWhitespace(value);

    return normalized || undefined;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return undefined;
}

function getFirstArrayValue(
  value: unknown
): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  for (const item of value) {
    const normalized =
      stringValue(item);

    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function getFindingId(
  finding: CanonicalFinding
): string {
  const value = finding as any;

  return String(
    value.findingId ||
      value.id ||
      value.sourceId ||
      value.documentId ||
      "unknown"
  );
}

function getPlatform(
  finding: CanonicalFinding
): string | undefined {
  const value = finding as any;

  return (
    stringValue(value.platform) ||
    getFirstArrayValue(
      value.platforms
    ) ||
    stringValue(
      value.structuredData
        ?.platform
    )
  );
}

function getSourceType(
  finding: CanonicalFinding
): string | undefined {
  const value = finding as any;

  return (
    stringValue(value.sourceType) ||
    stringValue(
      value.structuredData
        ?.sourceType
    ) ||
    stringValue(
      value.evidence?.[0]
        ?.sourceType
    )
  );
}

function getTherapeuticArea(
  finding: CanonicalFinding
): string | undefined {
  const value = finding as any;

  return (
    stringValue(
      value.therapeuticArea
    ) ||
    stringValue(
      value.diseaseArea
    ) ||
    stringValue(
      value.profileId
    )
  );
}

function getUrl(
  finding: CanonicalFinding
): string | undefined {
  const value = finding as any;

  return (
    stringValue(value.url) ||
    stringValue(
      value.structuredData?.url
    ) ||
    stringValue(
      value.evidence?.[0]?.url
    )
  );
}

function buildFieldDiagnostic(
  field: string,
  value: unknown
): TextFieldDiagnostic {
  const normalized =
    stringValue(value);

  return {
    field,
    value: normalized,
    length:
      normalized?.length || 0,
    isPopulated:
      Boolean(normalized),
  };
}

function collectStandardFields(
  finding: CanonicalFinding
): TextFieldDiagnostic[] {
  const value = finding as any;

  return STANDARD_TEXT_FIELDS.map(
    (field) =>
      buildFieldDiagnostic(
        field,
        value[field]
      )
  );
}

function collectObjectTextFields(
  object: unknown,
  prefix: string
): TextFieldDiagnostic[] {
  if (
    !object ||
    typeof object !== "object" ||
    Array.isArray(object)
  ) {
    return [];
  }

  const diagnostics:
    TextFieldDiagnostic[] = [];

  for (
    const [key, rawValue] of Object.entries(
      object as Record<
        string,
        unknown
      >
    )
  ) {
    const normalizedKey = key
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (
      !POSSIBLE_TEXT_FIELD_NAMES.has(
        normalizedKey
      )
    ) {
      continue;
    }

    const field =
      `${prefix}.${key}`;

    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean"
    ) {
      diagnostics.push(
        buildFieldDiagnostic(
          field,
          rawValue
        )
      );

      continue;
    }

    if (
      Array.isArray(rawValue)
    ) {
      const combined = rawValue
        .map(stringValue)
        .filter(
          (
            item
          ): item is string =>
            Boolean(item)
        )
        .join(" ");

      diagnostics.push(
        buildFieldDiagnostic(
          field,
          combined
        )
      );
    }
  }

  return diagnostics;
}

function uniqueTextSegments(
  values: string[]
): string[] {
  const seen =
    new Set<string>();

  const unique: string[] = [];

  for (const value of values) {
    const normalized =
      normalizeWhitespace(value);

    const dedupeKey = normalized
      .toLowerCase()
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();

    if (
      !dedupeKey ||
      seen.has(dedupeKey)
    ) {
      continue;
    }

    seen.add(dedupeKey);
    unique.push(normalized);
  }

  return unique;
}

function getRisk(
  params: {
    analyzableTextLength: number;
    uniqueAnalyzableTextLength: number;
    platform?: string;
    evidenceClass?: string;
    possibleIgnoredTextFields:
      TextFieldDiagnostic[];
  }
): {
  risk:
    | "none"
    | "low"
    | "moderate"
    | "high";

  reasons: string[];
} {
  const {
    analyzableTextLength,
    uniqueAnalyzableTextLength,
    platform,
    evidenceClass,
    possibleIgnoredTextFields,
  } = params;

  const reasons: string[] = [];

  const normalizedPlatform =
    String(platform || "")
      .toLowerCase();

  const isSocial =
    normalizedPlatform.includes(
      "social"
    ) ||
    normalizedPlatform.includes(
      "forum"
    ) ||
    normalizedPlatform.includes(
      "review"
    );

  if (
    analyzableTextLength === 0
  ) {
    reasons.push(
      "No analyzable text was mapped into the canonical finding"
    );
  } else if (
    analyzableTextLength <
    MINIMUM_ANALYZABLE_TEXT_LENGTH
  ) {
    reasons.push(
      `Analyzable text is below ${MINIMUM_ANALYZABLE_TEXT_LENGTH} characters`
    );
  }

  if (
    uniqueAnalyzableTextLength <
      analyzableTextLength *
        0.6 &&
    analyzableTextLength > 0
  ) {
    reasons.push(
      "Most analyzable text appears duplicated across fields"
    );
  }

  if (
    possibleIgnoredTextFields.some(
      (field) =>
        field.isPopulated &&
        field.length >=
          MINIMUM_ANALYZABLE_TEXT_LENGTH
    )
  ) {
    reasons.push(
      "A potentially useful raw text field may not be mapped into the canonical finding"
    );
  }

  if (
    isSocial &&
    evidenceClass === "unknown"
  ) {
    reasons.push(
      "Social content remains unclassified"
    );
  }

  if (
    isSocial &&
    analyzableTextLength <
      MINIMUM_ANALYZABLE_TEXT_LENGTH
  ) {
    reasons.push(
      "Social classification is likely constrained by insufficient post text"
    );
  }

  if (
    reasons.some((reason) =>
      reason.includes(
        "No analyzable text"
      )
    )
  ) {
    return {
      risk: "high",
      reasons,
    };
  }

  if (
    reasons.length >= 3
  ) {
    return {
      risk: "high",
      reasons,
    };
  }

  if (
    reasons.length === 2
  ) {
    return {
      risk: "moderate",
      reasons,
    };
  }

  if (
    reasons.length === 1
  ) {
    return {
      risk: "low",
      reasons,
    };
  }

  return {
    risk: "none",
    reasons: [],
  };
}

export function auditFindingText(
  finding: CanonicalFinding
): FindingTextDiagnostic {
  const value = finding as any;

  const intelligence =
    value.evidenceIntelligence;

  const standardFields =
    collectStandardFields(finding);

  const structuredDataFields =
    collectObjectTextFields(
      value.structuredData,
      "structuredData"
    );

  const primaryEvidence =
    Array.isArray(
      value.evidence
    )
      ? value.evidence[0]
      : undefined;

  const evidenceFields =
    collectObjectTextFields(
      primaryEvidence,
      "evidence[0]"
    );

  const populatedStandardFields =
    standardFields.filter(
      (field) =>
        field.isPopulated
    );

  const standardTextValues =
    populatedStandardFields
      .map((field) => field.value)
      .filter(
        (
          item
        ): item is string =>
          Boolean(item)
      );

  const analyzableText =
    normalizeWhitespace(
      standardTextValues.join(" ")
    );

  const uniqueAnalyzableText =
    uniqueTextSegments(
      standardTextValues
    ).join(" ");

  const standardFieldNames =
    new Set(
      STANDARD_TEXT_FIELDS.map(
        (field) =>
          field.toLowerCase()
      )
    );

  const possibleIgnoredTextFields =
    [
      ...structuredDataFields,
      ...evidenceFields,
    ].filter((field) => {
      const finalSegment =
        field.field
          .split(".")
          .pop()
          ?.toLowerCase() ||
        "";

      return (
        field.isPopulated &&
        !standardFieldNames.has(
          finalSegment
        )
      );
    });

  const platform =
    getPlatform(finding);

  const evidenceClass =
    stringValue(
      intelligence?.evidenceClass
    );

  const risk =
    getRisk({
      analyzableTextLength:
        analyzableText.length,

      uniqueAnalyzableTextLength:
        uniqueAnalyzableText.length,

      platform,

      evidenceClass,

      possibleIgnoredTextFields,
    });

  return {
    findingId:
      getFindingId(finding),

    therapeuticArea:
      getTherapeuticArea(
        finding
      ),

    sourceType:
      getSourceType(finding),

    platform,

    publicationType:
      stringValue(
        intelligence
          ?.publicationType
      ),

    evidenceClass,

    evidenceVoice:
      stringValue(
        intelligence?.voice
      ),

    title:
      stringValue(value.title),

    summary:
      stringValue(value.summary),

    excerpt:
      stringValue(value.excerpt),

    description:
      stringValue(
        value.description
      ),

    canonicalClaim:
      stringValue(
        value.canonicalClaim
      ),

    bodyText:
      stringValue(
        value.text
      ) ||
      stringValue(value.body) ||
      stringValue(
        value.content
      ) ||
      stringValue(
        value.postText
      ),

    url:
      getUrl(finding),

    populatedTextFields:
      populatedStandardFields.map(
        (field) => field.field
      ),

    emptyTextFields:
      standardFields
        .filter(
          (field) =>
            !field.isPopulated
        )
        .map(
          (field) =>
            field.field
        ),

    analyzableText,

    analyzableTextLength:
      analyzableText.length,

    uniqueAnalyzableTextLength:
      uniqueAnalyzableText.length,

    structuredDataKeys:
      Object.keys(
        value.structuredData ||
          {}
      ).sort(),

    evidenceObjectKeys:
      primaryEvidence &&
      typeof primaryEvidence ===
        "object"
        ? Object.keys(
            primaryEvidence
          ).sort()
        : [],

    possibleIgnoredTextFields,

    hasMinimumText:
      analyzableText.length >=
      MINIMUM_ANALYZABLE_TEXT_LENGTH,

    hasRichText:
      analyzableText.length >=
      RICH_TEXT_LENGTH,

    hasUrl:
      Boolean(getUrl(finding)),

    ingestionRisk:
      risk.risk,

    ingestionRiskReasons:
      risk.reasons,
  };
}