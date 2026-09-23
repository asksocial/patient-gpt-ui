# ICSR candidate to E2B(R3) mapping adapter

## Purpose

The adapter runs after AskSocial PV relevance detection and ICSR candidate evaluation. It creates an E2B(R3)-aligned mapping package for downstream human PV review. It does not generate an E2B XML message, assign official case identifiers, determine reportability, validate medical causality, or claim regulatory-submission readiness.

The authoritative target remains unchanged:

- `config/pv/e2b-r3/mappings/asksocial-e2b-r3-2026.01.0.json`
- `config/pv/e2b-r3/email/client-ae-notification-1.0.0.json`

The independent adapter configuration is `config/pv/icsr-e2b-adapter/manifest.json`. It pins the supported candidate evaluator, E2B mapping, and client email versions. Updating any target requires a new adapter version and validation; it does not permit editing an activated E2B package in place.

## Value lineage

Every populated target field retains three non-destructive channels:

```json
{
  "source_value": "trouble swallowing",
  "normalized_value": "difficulty swallowing",
  "reviewed_value": null,
  "value_source": "SOURCE",
  "confidence": 0.98
}
```

`value_source` identifies the channel selected for current downstream display. Human review can become the selected channel without deleting either source or normalized values. Source-as-reported product and reaction fields select `SOURCE` by default. AI-normalized values are never silently promoted to human-reviewed values.

## Repeating structures

Each supported medicinal product becomes an independent `G.k` occurrence. Each observed event becomes an independent `E.i` occurrence. The adapter does not create a causal cross-product between drugs and reactions. MedDRA PT-name candidates are retained as coding suggestions and never placed into the official MedDRA code field.

## Unavailable information

The adapter derives one explicit behavior from each authoritative field policy:

- `omit`
- `null`
- `unknown`
- `masked`
- `route_for_human_completion`

Missing required R3 fields produce `EXPECTED_R3_FIELD_UNAVAILABLE` errors containing the R3 field, occurrence, requirement, and completion behavior. Fields requiring human validation produce `HUMAN_REVIEW_REQUIRED` until a reviewed value with reviewer identity and timestamp is supplied.

## Evidence and provenance

The result retains:

- the exact original social mention;
- username or handle, source platform, URL, and post ID;
- original publication, collection, algorithm, review, and escalation timestamps;
- evaluator version, status, limitations, and confidences;
- candidate MedDRA PT suggestions separately from validated coding;
- reviewer identity and review time for each human-reviewed target value;
- mapping, terminology, email-template, and adapter versions.

Potential duplicates are retained as separate records. Exact source platform, post ID, and URL matches create a `POSSIBLE_DUPLICATE_CASE` warning and a non-destructive link to the earlier case.

## Client email projection

The client-email representation is built separately and can only emit fields listed in the active approved client AE/ADR notification template. It does not reuse the entire regulatory mapping, expose internal prompts, or add unapproved fields.

## API

```ts
mapIcsrCandidateToE2b(input)
mapIcsrCandidateBatchToE2b(inputs)
getIcsrE2bAdapterManifest()
```

The result is an intake/mapping artifact for human and downstream safety-system completion. `regulatory_submission_ready` is always `false` in AskSocial.
