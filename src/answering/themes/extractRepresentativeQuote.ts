import { CanonicalFinding } from "../models/finding";
import { THEME_QUALITY_CONFIG } from "./themeQualityConfig";

function normalizeWhitespace(
  value: string
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function removeTrackingFragments(
  value: string
): string {
  return value
    .replace(
      /https?:\/\/(?:t\.co|bit\.ly|lnkd\.in)\/\S+/gi,
      ""
    )
    .replace(
      /\butm_[a-z_]+=\S+/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function removeExcessiveHashtags(
  value: string
): string {
  const parts = value.split(/\s+/);
  let hashtagCount = 0;

  return parts
    .filter((part) => {
      if (
        !part.startsWith("#")
      ) {
        return true;
      }

      hashtagCount += 1;

      return hashtagCount <= 2;
    })
    .join(" ");
}

function truncateAtBoundary(
  value: string,
  maximumLength: number
): string {
  if (
    value.length <=
    maximumLength
  ) {
    return value;
  }

  const shortened = value.slice(
    0,
    maximumLength - 1
  );

  const sentenceBoundary =
    Math.max(
      shortened.lastIndexOf("."),
      shortened.lastIndexOf("!"),
      shortened.lastIndexOf("?")
    );

  if (
    sentenceBoundary >=
    maximumLength * 0.55
  ) {
    return shortened
      .slice(
        0,
        sentenceBoundary + 1
      )
      .trim();
  }

  const wordBoundary =
    shortened.lastIndexOf(" ");

  if (wordBoundary > 0) {
    return `${shortened
      .slice(0, wordBoundary)
      .trim()}…`;
  }

  return `${shortened.trim()}…`;
}

function getEvidenceExcerpt(
  finding: CanonicalFinding
): string {
  const evidence = Array.isArray(
    (finding as any).evidence
  )
    ? (finding as any).evidence
    : [];

  for (const item of evidence) {
    const excerpt = String(
      item?.excerpt || ""
    ).trim();

    if (excerpt) {
      return excerpt;
    }
  }

  return "";
}

export function extractRepresentativeQuote(
  finding: CanonicalFinding,
  maximumLength =
    THEME_QUALITY_CONFIG.maximumQuoteLength
): string {
  const f = finding as any;

  const candidates = [
    getEvidenceExcerpt(finding),
    f.excerpt,
    f.summary,
    f.canonicalClaim,
    f.title,
    f.description,
    f.text,
  ];

  const rawValue = candidates
    .map((value) =>
      String(value || "").trim()
    )
    .find(Boolean);

  if (!rawValue) {
    return "";
  }

  const cleaned =
    removeExcessiveHashtags(
      removeTrackingFragments(
        normalizeWhitespace(
          rawValue
        )
      )
    );

  return truncateAtBoundary(
    cleaned,
    maximumLength
  );
}