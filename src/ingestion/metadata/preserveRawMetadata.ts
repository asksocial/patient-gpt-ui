import {
  normalizeMetadataKey,
} from "./normalizeMetadataKey";
import type {
  PreservedRawMetadata,
  RawMetadataPreservationOptions,
  RawMetadataScalar,
  RawMetadataValue,
} from "./types";

const DEFAULT_MAXIMUM_STRING_LENGTH =
  50_000;

const DEFAULT_MAXIMUM_ARRAY_LENGTH =
  100;

/**
 * These are complete normalized field names or meaningful
 * token combinations. Matching is deliberately stricter
 * than substring matching so that fields such as
 * "sentiment" are not classified as temporal merely
 * because they contain the letters "time".
 */
const TEXT_FIELD_PATTERNS = [
  "text",
  "body",
  "body_text",
  "content",
  "content_text",
  "message",
  "caption",
  "description",
  "summary",
  "excerpt",
  "snippet",
  "headline",
  "title",
  "hit_sentence",
  "opening_text",
  "sentence",
  "transcript",
  "comment_text",
  "post",
  "post_text",
  "article",
  "article_text",
  "article_body",
  "full_text",
  "document_text",
];

const AUTHOR_FIELD_PATTERNS = [
  "author",
  "author_name",
  "author_handle",
  "author_bio",
  "author_biography",
  "author_followers",
  "author_following",
  "author_verified",
  "username",
  "user_name",
  "handle",
  "account",
  "account_name",
  "account_handle",
  "account_type",
  "profile",
  "profile_name",
  "profile_handle",
  "profile_bio",
  "profile_description",
  "bio",
  "biography",
  "publisher",
  "publisher_name",
  "publication",
  "publication_name",
  "organization",
  "organisation",
  "company",
  "occupation",
  "job_title",
  "verified",
  "followers",
  "following",
];

const ENGAGEMENT_FIELD_PATTERNS = [
  "engagement",
  "engagement_count",
  "likes",
  "like_count",
  "comments",
  "comment_count",
  "shares",
  "share_count",
  "reposts",
  "repost_count",
  "retweets",
  "retweet_count",
  "views",
  "view_count",
  "reach",
  "impressions",
  "reactions",
  "reaction_count",
];

const TEMPORAL_FIELD_PATTERNS = [
  "date",
  "time",
  "timestamp",
  "published_date",
  "published_time",
  "published_at",
  "publication_date",
  "created_date",
  "created_time",
  "created_at",
  "updated_date",
  "updated_time",
  "updated_at",
  "modified_date",
  "modified_time",
  "modified_at",
  "collected_date",
  "collected_time",
  "collected_at",
  "indexed_date",
  "indexed_time",
  "indexed_at",
];

const URL_FIELD_PATTERNS = [
  "url",
  "uri",
  "link",
  "permalink",
  "source_url",
  "source_link",
  "profile_url",
  "profile_link",
  "author_url",
  "author_link",
  "thumbnail",
  "thumbnail_url",
  "image",
  "image_url",
  "video_url",
];

function normalizeString(
  value: string,
  maximumLength: number
): string {
  const normalized = value
    .replace(/\u0000/g, "")
    .trim();

  if (
    normalized.length <=
    maximumLength
  ) {
    return normalized;
  }

  return normalized.slice(
    0,
    maximumLength
  );
}

function convertScalar(
  value: unknown,
  maximumStringLength: number
): RawMetadataScalar | undefined {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "string"
  ) {
    return normalizeString(
      value,
      maximumStringLength
    );
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : String(value);
  }

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return undefined;
}

function convertValue(
  value: unknown,
  maximumStringLength: number,
  maximumArrayLength: number
): RawMetadataValue | undefined {
  const scalar = convertScalar(
    value,
    maximumStringLength
  );

  if (
    scalar !== undefined
  ) {
    return scalar;
  }

  if (Array.isArray(value)) {
    const converted = value
      .slice(
        0,
        maximumArrayLength
      )
      .map((item) =>
        convertScalar(
          item,
          maximumStringLength
        )
      )
      .filter(
        (
          item
        ): item is RawMetadataScalar =>
          item !== undefined
      );

    return converted;
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    try {
      return normalizeString(
        JSON.stringify(value),
        maximumStringLength
      );
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function isPopulated(
  value: RawMetadataValue
): boolean {
  if (Array.isArray(value)) {
    return value.some(
      (item) =>
        item !== null &&
        String(item).trim() !== ""
    );
  }

  return (
    value !== null &&
    String(value).trim() !== ""
  );
}

/**
 * Matches either:
 *
 * 1. An exact normalized field name, or
 * 2. A field composed of meaningful underscore-delimited
 *    tokens matching a multi-token pattern.
 *
 * It does not use unrestricted substring matching.
 */
function matchesPattern(
  normalizedKey: string,
  patterns: string[]
): boolean {
  const keyTokens =
    normalizedKey
      .split("_")
      .filter(Boolean);

  return patterns.some(
    (pattern) => {
      const normalizedPattern =
        normalizeMetadataKey(
          pattern
        );

      if (
        normalizedKey ===
        normalizedPattern
      ) {
        return true;
      }

      const patternTokens =
        normalizedPattern
          .split("_")
          .filter(Boolean);

      /**
       * A single-token pattern must match a complete token.
       * This prevents "time" from matching "sentiment".
       */
      if (
        patternTokens.length === 1
      ) {
        return keyTokens.includes(
          patternTokens[0]
        );
      }

      /**
       * Multi-token patterns may match a contiguous token
       * sequence such as:
       *
       * author + bio
       * published + date
       * opening + text
       */
      for (
        let index = 0;
        index <=
        keyTokens.length -
          patternTokens.length;
        index += 1
      ) {
        const candidate =
          keyTokens
            .slice(
              index,
              index +
                patternTokens.length
            )
            .join("_");

        if (
          candidate ===
          normalizedPattern
        ) {
          return true;
        }
      }

      return false;
    }
  );
}

function getMatchingFieldNames(
  fieldNames: string[],
  patterns: string[]
): string[] {
  return fieldNames.filter(
    (fieldName) =>
      matchesPattern(
        normalizeMetadataKey(
          fieldName
        ),
        patterns
      )
  );
}

export function preserveRawMetadata(
  rawRecord: Record<
    string,
    unknown
  >,
  options:
    RawMetadataPreservationOptions
): PreservedRawMetadata {
  const maximumStringLength =
    options.maximumStringLength ??
    DEFAULT_MAXIMUM_STRING_LENGTH;

  const maximumArrayLength =
    options.maximumArrayLength ??
    DEFAULT_MAXIMUM_ARRAY_LENGTH;

  const excludedFields =
    new Set(
      (
        options.excludedFields ||
        []
      ).map(
        normalizeMetadataKey
      )
    );

  const fields: Record<
    string,
    RawMetadataValue
  > = {};

  const normalizedFields: Record<
    string,
    RawMetadataValue
  > = {};

  const originalKeys =
    Object.keys(
      rawRecord
    ).sort(
      (
        first,
        second
      ) =>
        first.localeCompare(
          second
        )
    );

  for (
    const key of originalKeys
  ) {
    const normalizedKey =
      normalizeMetadataKey(
        key
      );

    if (
      !normalizedKey ||
      excludedFields.has(
        normalizedKey
      )
    ) {
      continue;
    }

    const convertedValue =
      convertValue(
        rawRecord[key],
        maximumStringLength,
        maximumArrayLength
      );

    if (
      convertedValue ===
      undefined
    ) {
      continue;
    }

    fields[key] =
      convertedValue;

    /**
     * Preserve every original key in `fields`.
     * When two source columns normalize to the same key,
     * the first value is retained in the normalized index.
     */
    if (
      !(
        normalizedKey in
        normalizedFields
      )
    ) {
      normalizedFields[
        normalizedKey
      ] = convertedValue;
    }
  }

  const fieldNames =
    Object.keys(fields);

  const populatedFieldNames =
    fieldNames.filter(
      (fieldName) =>
        isPopulated(
          fields[fieldName]
        )
    );

  return {
    adapter:
      options.adapter,

    sourceProvider:
      options.sourceProvider,

    fields,

    normalizedFields,

    fieldNames,

    populatedFieldNames,

    textFieldNames:
      getMatchingFieldNames(
        populatedFieldNames,
        TEXT_FIELD_PATTERNS
      ),

    authorFieldNames:
      getMatchingFieldNames(
        populatedFieldNames,
        AUTHOR_FIELD_PATTERNS
      ),

    engagementFieldNames:
      getMatchingFieldNames(
        populatedFieldNames,
        ENGAGEMENT_FIELD_PATTERNS
      ),

    temporalFieldNames:
      getMatchingFieldNames(
        populatedFieldNames,
        TEMPORAL_FIELD_PATTERNS
      ),

    urlFieldNames:
      getMatchingFieldNames(
        populatedFieldNames,
        URL_FIELD_PATTERNS
      ),

    fieldCount:
      fieldNames.length,

    populatedFieldCount:
      populatedFieldNames.length,

    preservedAt:
      new Date().toISOString(),
  };
}