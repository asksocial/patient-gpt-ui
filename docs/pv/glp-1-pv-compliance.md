# GLP-1 PV Compliance

GLP-1 uses the established AskSocial PV lifecycle: potential detection, AE/ADR or
Health Experience routing, qualified review, minimum-criteria assessment, governed
clocks, sponsor handoff, E2B-aligned case preparation, and reconciliation.

## FDA reference retrieval

The shared openFDA client now accepts an explicit topic configuration. Existing
Botulinum behavior and its normalized schema remain compatible. GLP-1 normalization
uses `is_target_product`; GLP-1 records do not carry Botulinum flags.

The registry covers semaglutide, tirzepatide (dual GIP/GLP-1 agonist), liraglutide,
dulaglutide, exenatide, and lixisenatide, with historical brand aliases and insulin
combination products. Scope is not a claim of current marketing status. Registry
sources are recorded in `config/pv/glp-1/products-2026.01.0.json`.

The initial live retrieval on October 20, 2026 used the configured `OPENFDA_API_KEY`:

- 60 exact-field brand/ingredient queries, newest receive dates first.
- One page of up to 100 reports per query, followed by same-drug-object suspect-role filtering.
- 1,638 unique retained reports and 983 distinct source reaction terms.
- Zero failed queries. The overall snapshot is **partial** because further pages
  remain for 46 queries. Fourteen queries exhausted their results (including empty results).
- FDA returned July 30, 2026 as its last-updated metadata on non-empty responses.

The deployed reference summary is
`config/pv/glp-1/faers-reference-2026-10-20.json`. It includes query provenance,
source totals, completion state, per-term co-report counts, source report examples,
configuration versions, and the raw snapshot manifest SHA-256. Raw source JSON,
observations, normalized cases, and a manifest are retained locally in
`data/pv-training/regulatory/glp-1/2026-10-20T16-35-17-571Z/`.
This audit directory is ignored by Git. Preserve it in the approved evidence store
before removing the local checkout; the bundled summary does not replace raw evidence.

```bash
# New immutable bounded snapshot. Existing output files are never overwritten.
npm run faers:glp-1 -- --pages=1 --reference=/path/to/new-reference.json

# Exhaust available pages using the shared paging/retry/deduplication client.
npm run faers:glp-1 -- --full --reference=/path/to/new-reference.json
```

A deliberately bounded run is labeled partial even when every request succeeds.
Failed queries also remain visible and cause a nonzero CLI exit. Review a new
snapshot and update the reference import deliberately when promoting it. Keep
API keys in environment configuration; query provenance excludes credentials.

FAERS reports can contain multiple drugs and reactions without a source-supported
pairwise link. Counts do not establish incidence, causality, expectedness, or final
reportability. Original source terms such as “No adverse event” remain reference
vocabulary, not adverse-event detection rules. Raw MedDRA terms are preserved;
codes and hierarchy are not invented.

## Social screening

The PV reference panel appears for GLP-1 in Compliance Overview, Review Queue, Health Experience Detection, and PV Configuration.
It displays reference coverage, reaction examples, FDA queries, and social screening
eligibility. The authenticated `/api/pv/corpora/glp-1` endpoint requires both a PV
entitlement and GLP-1 topic access.

1. Set up the GLP-1 detection library. It is created in **draft**, with no fabricated
   approval or configured label expectedness.
2. A qualified user reviews concepts and approves the library through the existing
   approval control in PV Configuration.
3. Screen the GLP-1 social corpus. Results enter the existing human review workflow.

The source export is preserved. Its 5,000 rows reconcile as:

- 811 eligible English social rows.
- 2,865 held for non-English or unknown language.
- 1,317 held for a source requiring separate screening scope (e.g. news).
- 7 held for absent or unusable HTTP(S) source URLs.
- Zero parse failures.

The updated source-text policy proposes five candidates in this export: four
AE/ADR Review Queue candidates and one Health Experience Detection candidate.
These are potential detections, not confirmed cases. Parent headlines no longer
establish a commenter’s own exposure or adverse experience; their titles remain
explicitly labeled source context. This removes one headline-derived candidate
from the earlier six-candidate preview. Rules cover product aliases,
curated reaction expressions, pregnancy exposure, medication error, overdose,
misuse, lack of efficacy, and product quality. Source reaction vocabulary and
matched curated terms are exposed separately; raw FAERS terms are not automatically
activated as screening rules. English rules are an initial implementation, not a
claim of validated recall, multilingual performance, or clinical adjudication.

Screening handles basic negation, hypothetical risk language, and exposure context.
Multiple-treatment and switching language remains a specific review limitation;
the proposed product is provisional. Unsupported languages are held rather than
treated as negative detections. Original Date + Time are retained and interpreted
as UTC because this export supplies no timezone; the UI discloses this assumption.

Every source row receives the current audience classification before PV eligibility
checks. Full-source audience counts and held-row reasons are displayed alongside
the candidate preview. Audience labels do not determine PV reportability or extend
English screening to unsupported languages. The source-text policy and audience
version are bound into the import fingerprint and audit provenance.

Persisted results use the approved database concepts and thresholds. Source IDs are
namespaced, inserts preserve existing review state, and re-runs deduplicate. Earlier persisted
candidates remain historical workflow records; a changed preview does not silently
delete or close them. Existing candidates require human reconciliation. Import
batches bind the source hash and detection configuration for provenance. Each
configuration fingerprint receives its own corpus batch identifier, allowing
rescreening under the database’s principal/corpus uniqueness constraint while
retaining earlier import history. A partial
write can be resumed. Held rows remain counted and audited; the import is marked
`completed_with_errors`, never presented as complete source coverage.

FAERS reference reports are not inserted into the social review queue, counted as
newly received sponsor cases, or assigned new social case clocks. Social case Day
Zero remains unset until qualified review confirms the minimum criteria. If
`ASKSOCIAL_REQUIRE_ODCS_SCOPE=true`, bundled screening is prohibited; use the library
with an approved client-scoped source import. No ODCS qualification is fabricated.

## Verification and rollout

`npm run test:glp-1-pv` checks detection contrasts, English-language enforcement,
same-object suspect filtering, normalized topic isolation, source-count reconciliation,
Day Zero, E2B case assembly, draft approval, re-run deduplication, preservation of
reviewed records, tenant isolation, and the ODCS gate. Service persistence tests use
an in-memory Supabase REST transport; they do not establish deployed HTTP auth or
multi-connection database concurrency acceptance.

The production bundle includes the GLP-1 CSV on its PV endpoint. Deploy the source
changes and reference snapshot together. This work does not activate a tenant's
library, approve an ODCS program, send a sponsor message, or submit a case to FDA.

Sources: [FDA FAERS API](https://open.fda.gov/apis/drug/event/),
[FDA pagination](https://open.fda.gov/apis/paging/),
[FDA field reference](https://open.fda.gov/apis/drug/event/searchable-fields/).

## Coverage audit — October 23, 2026

The supplied CSV is byte-identical to the original GLP-1 export. Audience
reclassification expanded analytical inclusion; it did not add source rows or
extend the approved PV library. Current PV eligibility remains 811/5,000 rows
(16.22%). Language holds account for 2,865 rows, source-scope holds for 1,317,
and absent/unusable links for seven. Held rows are unassessed, not negative.

Among eligible English rows, 49 match both product and health-event vocabulary
before context filtering. Five remain after assertion/negation, hypothetical
language, exposure, promotional and threshold rules. These 49 co-occurrences
are not 49 AE/ADR cases; the difference requires source-level validation to
measure false negatives. No sensitivity or full-corpus safety-coverage claim
is supported by the small candidate total. Multilingual screening and rule
expansion require separately qualified detection configurations and validation.
