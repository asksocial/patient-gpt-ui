export type RawMetadataScalar =
  | string
  | number
  | boolean
  | null;

export type RawMetadataValue =
  | RawMetadataScalar
  | RawMetadataScalar[];

export type PreservedRawMetadata = {
  /**
   * Identifies the ingestion adapter that preserved the record.
   */
  adapter: string;

  /**
   * Identifies the original data provider.
   */
  sourceProvider: string;

  /**
   * Original column names and values exactly as received,
   * except for values that cannot be safely serialized.
   */
  fields: Record<string, RawMetadataValue>;

  /**
   * Case- and punctuation-normalized lookup index.
   * The original fields remain available in `fields`.
   */
  normalizedFields: Record<string, RawMetadataValue>;

  /**
   * All original keys in deterministic order.
   */
  fieldNames: string[];

  /**
   * Keys containing non-empty scalar or array values.
   */
  populatedFieldNames: string[];

  /**
   * Keys whose values look like meaningful text.
   */
  textFieldNames: string[];

  /**
   * Keys that appear to describe an author, account,
   * organization, profile, handle, or publisher.
   */
  authorFieldNames: string[];

  /**
   * Keys that appear to describe engagement.
   */
  engagementFieldNames: string[];

  /**
   * Keys that appear to describe dates or timestamps.
   */
  temporalFieldNames: string[];

  /**
   * Keys that appear to contain URLs.
   */
  urlFieldNames: string[];

  /**
   * Count of preserved columns.
   */
  fieldCount: number;

  /**
   * Count of non-empty preserved columns.
   */
  populatedFieldCount: number;

  /**
   * ISO timestamp for when preservation occurred.
   */
  preservedAt: string;
};

export type RawMetadataPreservationOptions = {
  adapter: string;
  sourceProvider: string;

  /**
   * Fields that must never be retained.
   * Matching is performed against normalized field names.
   */
  excludedFields?: string[];

  /**
   * Maximum length retained for one string value.
   * The default is 50,000 characters.
   */
  maximumStringLength?: number;

  /**
   * Maximum array elements retained from a single field.
   * The default is 100.
   */
  maximumArrayLength?: number;
};