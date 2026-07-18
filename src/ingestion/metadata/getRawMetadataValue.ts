import {
  normalizeMetadataKey,
} from "./normalizeMetadataKey";
import type {
  PreservedRawMetadata,
  RawMetadataValue,
} from "./types";

export function getRawMetadataValue(
  metadata:
    | PreservedRawMetadata
    | undefined,
  ...candidateFields: string[]
): RawMetadataValue | undefined {
  if (!metadata) {
    return undefined;
  }

  for (
    const candidateField of candidateFields
  ) {
    const normalizedCandidate =
      normalizeMetadataKey(
        candidateField
      );

    const normalizedValue =
      metadata.normalizedFields[
        normalizedCandidate
      ];

    if (
      normalizedValue !==
      undefined
    ) {
      return normalizedValue;
    }

    const originalMatch =
      metadata.fieldNames.find(
        (fieldName) =>
          normalizeMetadataKey(
            fieldName
          ) ===
          normalizedCandidate
      );

    if (originalMatch) {
      return metadata.fields[
        originalMatch
      ];
    }
  }

  return undefined;
}

export function getRawMetadataString(
  metadata:
    | PreservedRawMetadata
    | undefined,
  ...candidateFields: string[]
): string | undefined {
  const value =
    getRawMetadataValue(
      metadata,
      ...candidateFields
    );

  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const combined = value
      .filter(
        (item) =>
          item !== null &&
          String(item).trim() !==
            ""
      )
      .map(String)
      .join(" ")
      .trim();

    return combined || undefined;
  }

  const stringValue =
    String(value).trim();

  return stringValue || undefined;
}