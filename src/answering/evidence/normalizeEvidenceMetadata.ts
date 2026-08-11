import type {
  CanonicalFinding,
} from "../models/finding";
import {
  buildEvidenceText,
} from "./buildEvidenceText";
import type {
  NormalizedEvidenceMetadata,
  NormalizedPlatform,
} from "./types";
import {
  getRawMetadataString,
  getRawMetadataValue,
} from "../../ingestion/metadata";

function stringValue(
  value: unknown
): string | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  const output =
    String(value).trim();

  return output || undefined;
}

function numberValue(
  value: unknown
): number | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const normalized =
    String(value)
      .replace(/,/g, "")
      .trim();

  const output =
    Number(normalized);

  return Number.isFinite(output)
    ? output
    : undefined;
}

function firstArrayValue(
  value: unknown
): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const first =
    value.find(
      (item) =>
        stringValue(item)
    );

  return stringValue(first);
}

function uniqueStrings(
  values: Array<
    string | undefined
  >
): string[] {
  const seen =
    new Set<string>();

  const output:
    string[] = [];

  for (const value of values) {
    const normalized =
      stringValue(value);

    if (!normalized) {
      continue;
    }

    const key =
      normalized.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function extractHostname(
  url?: string
): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function normalizePlatformValue(
  value?: string
): NormalizedPlatform {
  const platform =
    String(value || "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .trim();

  if (
    platform.includes("social") ||
    platform.includes("twitter") ||
    platform.includes("x.com") ||
    platform.includes("facebook") ||
    platform.includes("instagram") ||
    platform.includes("linkedin") ||
    platform.includes("tiktok") ||
    platform.includes("pinterest")
  ) {
    return "social";
  }

  if (
    platform.includes("forum") ||
    platform.includes("reddit")
  ) {
    return "forum";
  }

  if (
    platform.includes("review")
  ) {
    return "review";
  }

  if (
    platform.includes("news") ||
    platform.includes("online news")
  ) {
    return "news";
  }

  if (
    platform.includes("blog")
  ) {
    return "blog";
  }

  if (
    platform.includes("video") ||
    platform.includes("youtube")
  ) {
    return "video";
  }

  if (
    platform.includes("podcast")
  ) {
    return "podcast";
  }

  if (
    platform.includes("research") ||
    platform.includes("journal")
  ) {
    return "research";
  }

  if (
    platform.includes("government")
  ) {
    return "government";
  }

  if (
    platform.includes("retail") ||
    platform.includes("shopping") ||
    platform.includes("ecommerce") ||
    platform.includes("e-commerce")
  ) {
    return "retail";
  }

  if (
    platform.includes("event") ||
    platform.includes("conference")
  ) {
    return "event";
  }

  return "unknown";
}

function combineDateAndTime(
  date?: string,
  time?: string
): string | undefined {
  if (!date) {
    return undefined;
  }

  if (!time) {
    return date;
  }

  const normalizedDate =
    date.trim();

  const normalizedTime =
    time.trim();

  if (
    !normalizedDate ||
    !normalizedTime
  ) {
    return (
      normalizedDate ||
      undefined
    );
  }

  if (/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i.test(normalizedDate)) {
    return normalizedDate;
  }

  return `${normalizedDate}T${normalizedTime}`;
}

function normalizePublishedDate(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  const meltwater = normalized.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i);
  if (!meltwater) return normalized;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months.indexOf(meltwater[2].toLowerCase());
  if (month < 0) return normalized;
  const rawYear = Number(meltwater[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  let hour = Number(meltwater[4] || 0);
  const minute = Number(meltwater[5] || 0);
  const meridiem = String(meltwater[6] || "").toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return new Date(Date.UTC(year, month, Number(meltwater[1]), hour, minute)).toISOString();
}

function buildEnrichedFullText(
  values: Array<
    string | undefined
  >
): string {
  return uniqueStrings(values)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEvidenceMetadata(
  finding: CanonicalFinding
): NormalizedEvidenceMetadata {
  const f =
    finding as any;

  const structured =
    f.structuredData || {};

  const rawMetadata =
    f.rawMetadata;

  const rawTitle =
    getRawMetadataString(
      rawMetadata,
      "Title"
    );

  const rawOpeningText =
    getRawMetadataString(
      rawMetadata,
      "Opening Text",
      "OpeningText"
    );

  const rawHitSentence =
    getRawMetadataString(
      rawMetadata,
      "Hit Sentence",
      "HitSentence"
    );

  const rawAuthor =
    getRawMetadataString(
      rawMetadata,
      "Author Name",
      "Author",
      "Username",
      "User Name"
    );

  const rawAuthorHandle =
    getRawMetadataString(
      rawMetadata,
      "Author Handle",
      "Handle",
      "Username",
      "Profile Handle"
    );

  const rawAuthorBio =
    getRawMetadataString(
      rawMetadata,
      "Author Bio",
      "Author Biography",
      "Profile Bio",
      "Profile Description",
      "Bio"
    );

  const rawSourceName =
    getRawMetadataString(
      rawMetadata,
      "Source Name",
      "Source",
      "Publisher",
      "Publication"
    );

  const rawContentType =
    getRawMetadataString(
      rawMetadata,
      "Content Type",
      "Document Type",
      "Media Type"
    );

  const rawPlatform =
    stringValue(f.platform) ||
    firstArrayValue(
      f.platforms
    ) ||
    stringValue(
      structured.platform
    ) ||
    getRawMetadataString(
      rawMetadata,
      "Source Type",
      "Platform",
      "Channel"
    );

  const url =
    stringValue(f.url) ||
    stringValue(
      structured.url
    ) ||
    stringValue(
      f.evidence?.[0]?.url
    ) ||
    getRawMetadataString(
      rawMetadata,
      "URL",
      "Link",
      "Permalink"
    );

  const title =
    stringValue(f.title) ||
    rawTitle;

  const summary =
    stringValue(f.summary) ||
    stringValue(
      structured.summary
    ) ||
    rawHitSentence ||
    rawOpeningText;

  const excerpt =
    stringValue(f.excerpt) ||
    rawHitSentence;

  const description =
    stringValue(
      f.description
    ) ||
    rawHitSentence ||
    rawOpeningText;

  const openingText =
    stringValue(f.text) ||
    stringValue(f.body) ||
    stringValue(f.content) ||
    rawOpeningText;

  const hitSentence =
    rawHitSentence ||
    stringValue(f.excerpt);

  const evidenceText =
    buildEvidenceText(
      finding
    );

  /**
   * The existing canonical evidence text remains first.
   * Raw metadata adds author and source context without
   * replacing or weakening the current content mapping.
   */
  const fullText =
    buildEnrichedFullText([
      evidenceText.normalizedText,
      title,
      summary,
      excerpt,
      description,
      openingText,
      hitSentence,
      rawAuthor,
      rawAuthorHandle,
      rawAuthorBio,
      rawSourceName,
      rawContentType,
      getRawMetadataString(
        rawMetadata,
        "Document Tags",
        "Tags",
        "Keywords",
        "Custom Categories"
      ),
    ]);

  const hostname =
    extractHostname(url);

  const rawDate =
    getRawMetadataString(
      rawMetadata,
      "Date",
      "Published Date",
      "Publication Date"
    );

  const rawTime =
    getRawMetadataString(
      rawMetadata,
      "Time",
      "Published Time",
      "Publication Time"
    );

  const publishedAt = normalizePublishedDate(
    stringValue(
      f.publishedAt
    ) ||
    stringValue(f.date) ||
    stringValue(
      structured.publishedAt
    ) ||
    combineDateAndTime(
      rawDate,
      rawTime
    )
  );

  const engagement =
    numberValue(f.score) ||
    numberValue(
      structured.engagement
    ) ||
    numberValue(
      getRawMetadataValue(
        rawMetadata,
        "Engagement"
      )
    );

  const reach =
    numberValue(
      structured.reach
    ) ||
    numberValue(
      getRawMetadataValue(
        rawMetadata,
        "Reach"
      )
    );

  const canonicalTags =
    Array.isArray(f.labels)
      ? f.labels.map(String)
      : [];

  const structuredTags =
    Array.isArray(
      structured.tags
    )
      ? structured.tags.map(String)
      : [];

  const rawTags =
    getRawMetadataString(
      rawMetadata,
      "Document Tags",
      "Tags",
      "Keywords",
      "Custom Categories"
    );

  return {
    url,

    domain:
      hostname,

    hostname,

    platform:
      rawPlatform,

    normalizedPlatform:
      normalizePlatformValue(
        rawPlatform
      ),

    sourceType:
      stringValue(
        f.sourceType
      ) ||
      stringValue(
        structured.sourceType
      ) ||
      rawMetadata
        ?.sourceProvider,

    sourceName:
      stringValue(
        f.sourceName
      ) ||
      stringValue(
        structured.sourceName
      ) ||
      rawSourceName,

    contentType:
      stringValue(
        f.contentType
      ) ||
      stringValue(
        structured.contentType
      ) ||
      rawContentType,

    title,

    summary,

    excerpt,

    description,

    openingText,

    hitSentence,

    fullText,

    author:
      stringValue(f.author) ||
      stringValue(
        structured.author
      ) ||
      rawAuthor,

    authorHandle:
      stringValue(
        f.authorHandle
      ) ||
      stringValue(
        structured.authorHandle
      ) ||
      rawAuthorHandle,

    authorBio:
      stringValue(
        f.authorBio
      ) ||
      stringValue(
        structured.authorBio
      ) ||
      rawAuthorBio,

    publication:
      stringValue(
        f.publication
      ) ||
      stringValue(
        structured.publication
      ) ||
      rawSourceName,

    persona:
      stringValue(f.persona) ||
      firstArrayValue(
        f.personas
      ) ||
      stringValue(
        structured.persona
      ),

    country:
      stringValue(f.country) ||
      firstArrayValue(
        f.countries
      ) ||
      stringValue(
        structured.country
      ) ||
      getRawMetadataString(
        rawMetadata,
        "Country"
      ),

    publishedAt,

    engagement,

    reach,

    tags:
      uniqueStrings([
        ...canonicalTags,
        ...structuredTags,
        rawTags,
      ]),

    rawMetadataFieldCount:
      numberValue(
        rawMetadata?.fieldCount
      ),

    rawMetadataPopulatedFieldCount:
      numberValue(
        rawMetadata
          ?.populatedFieldCount
      ),
  };
}
