export type SourceType = "curated" | "meltwater";

export interface IngestionContext {
  sourceType: SourceType;
  therapeuticArea?: string;
  relevancePolicy?: "standard" | "prequalified";
  includeCurated?: boolean;
}
