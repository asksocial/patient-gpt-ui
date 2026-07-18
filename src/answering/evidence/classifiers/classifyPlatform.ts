import {
  NormalizedEvidenceMetadata,
  PlatformClassification,
} from "../types";

export function classifyPlatform(
  metadata: NormalizedEvidenceMetadata
): PlatformClassification {
  return {
    rawPlatform:
      metadata.platform,

    platform:
      metadata.normalizedPlatform,

    confidence:
      metadata.normalizedPlatform ===
      "unknown"
        ? 0.25
        : 0.9,
  };
}