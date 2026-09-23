# Botulinum toxin FAERS/openFDA regulatory case corpus

This implemented dataset is Phase 1 of the governed [botulinum toxin PV training-corpus architecture](./botulinum-toxin-pv-training-corpus-architecture.md). The project manifest and the proposed contracts for all four datasets live under `config/pv/training-corpus/botulinum-toxin/`. The later taxonomy, expression-library, and classifier-example datasets remain planned; this importer does not generate them.

## Scope

This ingestion layer retrieves FDA FAERS drug-event reports through the official openFDA API for the configured botulinum toxin brands and active ingredients. It preserves the complete source JSON and produces a separate normalized record for corpus development.

It does not determine medical causality, incidence, final reportability, or whether a particular drug caused a particular reaction. Every normalized case sets `causality_status` to `NOT_ESTABLISHED`.

## Versioned configuration

The active configuration is selected by:

- `config/pv/training-corpus/botulinum-toxin/regulatory/manifest.json`
- `config/pv/training-corpus/botulinum-toxin/manifest.json`
- `config/pv/training-corpus/botulinum-toxin/schemas/regulatory-case.schema.json`
- `products-2026.01.0.json`
- `openfda-mapping-2026.01.0.json`

Activated files are immutable. A product, query, field, code-list, paging, or retry change requires a new versioned file, registry entry, validation, and manifest update.

## Query approach

The importer creates independent exact-field queries for each configured brand and active ingredient:

- Brand: source medicinal-product value and openFDA brand annotation.
- Active ingredient: source medicinal-product value, source active-substance value, openFDA generic annotation, and openFDA substance annotation.
- Optional suspect-only mode: adds the configured `drugcharacterization=1` condition, then post-filters the matching drug object. This post-filter is required because a report can contain several drugs and an API-level match does not prove both conditions belong to the same array member.

The client sorts by receive date and follows the API-provided `search_after` link. HTTP 429 and server failures use versioned retry/backoff settings, including `Retry-After` when supplied. If a transient server failure exhausts the per-request retries partway through pagination, the query restarts from page one under a separate bounded whole-query retry policy; identifier deduplication prevents the replay from creating duplicate cases. If search-after repeatedly fails and the API-reported total is no more than 26,000, subsequent passes may start a distinct, explicitly audited `skip=0` fallback path using conservative 100-record pages. Fallback retries use a versioned 30-second cooldown to avoid repeatedly hitting a sustained API failure. The fallback is prohibited for larger result sets because it would exceed openFDA's documented result window.

The API key is added only to the outbound request and is removed from stored query provenance.

## CLI

```bash
npm run faers:botulinum
```

Useful controlled runs:

```bash
npm run faers:botulinum -- --product=BOTOX --max-records=100 --allow-partial
npm run faers:botulinum -- --product=DYSPORT,ABOBOTULINUMTOXINA --suspect-only
```

`OPENFDA_API_KEY` is required by the live CLI and must be supplied through the environment. It is never written to query provenance. Output defaults to a new timestamped directory under `data/pv-training/regulatory/botulinum-toxin/`. Existing snapshot directories are never overwritten.

Each snapshot contains:

- `raw-records.jsonl`: one complete raw source record and source-record hash per identifier/version. It is streamed to disk so a full corpus run does not retain all raw payloads in memory.
- `query-observations.jsonl`: every query hit, searched product, source query, retrieval timestamp, source product value, and source reaction value, including overlaps later removed by deduplication.
- `normalized-records.jsonl`: nested normalized cases, written one row at a time so full-corpus snapshots do not exceed JavaScript string-size limits during finalization.
- `malformed-records.jsonl`: unparseable or identifier-conflicting records retained for audit.
- `manifest.json`: versions, query outcomes, counts, completion status, and limitations.

## Data model

The normalized structure deliberately preserves:

```text
CASE
├── DRUGS[]
├── REACTIONS[]
└── OUTCOMES[] (linked only to the source reaction index when supplied)
```

No drug-to-reaction relationship collection is generated. A target-product flag or suspect role does not establish that the drug caused any reaction in the report.

Deduplication uses `FDA_FAERS_OPENFDA:{safetyreportid}:v{safetyreportversion}`. Overlapping product queries merge query observations into the retained record. Different source versions remain distinct. If the same key arrives with conflicting payloads, the first payload is retained and the conflict is written to malformed-record audit output.

The openFDA documentation describes `safetyreportid` as the case report number/case ID. Accordingly, the source value is preserved unchanged as both `faers_case_id` and `safety_report_id`; `authoritynumb` and `companynumb` remain separately available.

## Example normalized record

```json
{
  "case_id": "FDA_FAERS_OPENFDA:12345678:v2",
  "faers_case_id": "12345678",
  "safety_report_id": "12345678",
  "safety_report_version": "2",
  "serious_indicator": true,
  "seriousness_criteria": {
    "death": false,
    "life_threatening": false,
    "hospitalization": true,
    "disability": false,
    "congenital_anomaly": false,
    "other_medically_important": true
  },
  "drugs": [
    {
      "source_index": 0,
      "medicinal_product": "BOTOX COSMETIC",
      "active_ingredient": "ONABOTULINUMTOXINA",
      "drug_role": "suspect",
      "is_target_botulinum_product": true,
      "matched_target_product": "BOTOX COSMETIC",
      "matched_active_ingredient": "ONABOTULINUMTOXINA",
      "suspect_role_if_available": "suspect"
    },
    {
      "source_index": 1,
      "medicinal_product": "ASPIRIN",
      "drug_role": "concomitant",
      "is_target_botulinum_product": false
    }
  ],
  "reactions": [
    {
      "source_index": 0,
      "source_reaction_value": "Eyelid ptosis",
      "meddra_preferred_term": "Eyelid ptosis",
      "meddra_version": "27.1",
      "outcome": "recovering_resolving"
    }
  ],
  "outcomes": [
    {
      "source_reaction_index": 0,
      "source_reaction_value": "Eyelid ptosis",
      "outcome_code": "2",
      "outcome": "recovering_resolving"
    }
  ],
  "causality_status": "NOT_ESTABLISHED"
}
```

## Known limitations

- openFDA exposes publicly releasable FAERS reports and can lag the quarterly source release.
- openFDA currently returns only the latest report version; historical version ingestion requires the quarterly FAERS extracts or another approved source.
- FAERS is a spontaneous-reporting system and cannot establish incidence or causality.
- Multiple drugs and reactions can coexist without a source-supported pairwise relationship.
- openFDA annotations can differ from the medicinal-product value reported in the case.
- Missing values remain absent and are not imputed.
- Source-provided MedDRA Preferred Terms and versions are preserved; no absent MedDRA hierarchy or code is invented.
- A complete corpus run can require many API calls. The output manifest is `partial` after a query failure or deliberate limit and must not be promoted as a complete release.

## Authoritative sources

- https://open.fda.gov/apis/drug/event/
- https://open.fda.gov/apis/drug/event/searchable-fields/
- https://open.fda.gov/apis/paging/
- https://open.fda.gov/apis/authentication/
