import {
  getRawMetadataString,
  preserveRawMetadata,
} from "../../ingestion/metadata";

const rawRecord: Record<
  string,
  unknown
> = {
  "Document ID":
    "test-123",

  "Hit Sentence":
    "I tried PRF three months ago and noticed gradual improvement.",

  "Author Name":
    "Example User",

  "Author Bio":
    "Board-certified dermatologist",

  "Author Followers":
    12500,

  "Platform":
    "Instagram",

  "Published Date":
    "2026-07-14T12:30:00Z",

  "Engagement":
    247,

  "URL":
    "https://example.com/post/123",

  "Verified":
    true,

  "Topics": [
    "PRF",
    "regenerative aesthetics",
  ],

  "Nested Object": {
    source: "example",
    score: 0.8,
  },

  "Empty Field":
    "",

  "Null Field":
    null,
};

const metadata =
  preserveRawMetadata(
    rawRecord,
    {
      adapter:
        "meltwater",

      sourceProvider:
        "meltwater",
    }
  );

console.log(
  JSON.stringify(
    metadata,
    null,
    2
  )
);

const hitSentence =
  getRawMetadataString(
    metadata,
    "Hit Sentence"
  );

const authorBio =
  getRawMetadataString(
    metadata,
    "Author Bio"
  );

if (
  hitSentence !==
  rawRecord["Hit Sentence"]
) {
  throw new Error(
    "Hit Sentence was not preserved correctly."
  );
}

if (
  authorBio !==
  rawRecord["Author Bio"]
) {
  throw new Error(
    "Author Bio was not preserved correctly."
  );
}

if (
  metadata.fieldCount !==
  Object.keys(rawRecord).length
) {
  throw new Error(
    `Expected ${
      Object.keys(rawRecord)
        .length
    } preserved fields, received ${
      metadata.fieldCount
    }.`
  );
}

if (
  !metadata.textFieldNames.includes(
    "Hit Sentence"
  )
) {
  throw new Error(
    "Hit Sentence was not detected as a text field."
  );
}

if (
  !metadata.authorFieldNames.includes(
    "Author Bio"
  )
) {
  throw new Error(
    "Author Bio was not detected as an author field."
  );
}

if (
  !metadata.engagementFieldNames.includes(
    "Engagement"
  )
) {
  throw new Error(
    "Engagement was not detected as an engagement field."
  );
}

if (
  !metadata.temporalFieldNames.includes(
    "Published Date"
  )
) {
  throw new Error(
    "Published Date was not detected as a temporal field."
  );
}