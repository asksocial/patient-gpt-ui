export type TextFieldDiagnostic = {
  field: string;
  value?: string;
  length: number;
  isPopulated: boolean;
};

export type FindingTextDiagnostic = {
  findingId: string;

  therapeuticArea?: string;
  sourceType?: string;
  platform?: string;
  publicationType?: string;
  evidenceClass?: string;
  evidenceVoice?: string;

  title?: string;
  summary?: string;
  excerpt?: string;
  description?: string;
  canonicalClaim?: string;
  bodyText?: string;
  url?: string;

  populatedTextFields: string[];
  emptyTextFields: string[];

  analyzableText: string;
  analyzableTextLength: number;
  uniqueAnalyzableTextLength: number;

  structuredDataKeys: string[];
  evidenceObjectKeys: string[];

  possibleIgnoredTextFields: TextFieldDiagnostic[];

  hasMinimumText: boolean;
  hasRichText: boolean;
  hasUrl: boolean;

  ingestionRisk:
    | "none"
    | "low"
    | "moderate"
    | "high";

  ingestionRiskReasons: string[];
};

export type IngestionAuditSummary = {
  totalFindings: number;

  platformCounts: Record<string, number>;
  sourceTypeCounts: Record<string, number>;
  evidenceClassCounts: Record<string, number>;

  analyzableTextLengthBands: Record<
    string,
    number
  >;

  populatedFieldCounts: Record<
    string,
    number
  >;

  missingFieldCounts: Record<
    string,
    number
  >;

  ingestionRiskCounts: Record<
    string,
    number
  >;

  socialPostCount: number;
  socialPostsBelowMinimumText: number;
  socialPostsWithRichText: number;
  socialPostsClassifiedUnknown: number;

  socialUnknownWithShortText: number;
  socialUnknownWithRichText: number;

  findingsWithPossibleIgnoredText: number;

  averageAnalyzableTextLength: number;
  medianAnalyzableTextLength: number;
};

export type IngestionAuditResult = {
  summary: IngestionAuditSummary;

  firstSocialPosts:
    FindingTextDiagnostic[];

  socialUnknownExamples:
    FindingTextDiagnostic[];

  socialUnknownWithRichText:
    FindingTextDiagnostic[];

  shortestFindings:
    FindingTextDiagnostic[];

  longestFindings:
    FindingTextDiagnostic[];

  possibleIgnoredTextExamples:
    FindingTextDiagnostic[];
};