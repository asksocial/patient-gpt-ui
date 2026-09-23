# Botulinum toxin PV training-corpus architecture

## Purpose and current state

This is the governed blueprint for the AskSocial botulinum toxin pharmacovigilance training corpus. The corpus is intended to recognize language that may indicate a potentially reportable adverse event or another PV-relevant situation and route it for human review. It does not determine medical causality, incidence, or final reportability.

The regulatory case ingestion phase is implemented. The AE/ADR taxonomy, Consumer/Social Expression Library, and contrastive PV-recognition examples have been generated as governed drafts and remain pending qualified PV/medical review or human adjudication. The evaluation and operational-release phases are contracts and plans only; their presence here does not imply that those datasets have already been generated or approved.

The machine-readable project control is `config/pv/training-corpus/botulinum-toxin/manifest.json`. It records dataset status, dependencies, assumptions, unresolved decisions, implementation phases, and acceptance criteria. Published manifests and schemas are immutable; changes require a new version.

## 1. Proposed architecture

### Dataset packages

```text
FDA FAERS/openFDA
        │
        ▼
1. Regulatory Case Corpus ───────────────┐
        │                                │
        ▼                                │
2. AE/ADR Master Taxonomy                │
        │                                │
        ▼                                │
3. Consumer/Social Expression Library    │
        │                                │
        └──────────────────┬─────────────┘
                           ▼
4. PV Classifier Training Examples
                           │
                           ▼
Locked evaluation → controlled promotion → human-review routing
```

1. **Regulatory Case Corpus** preserves immutable raw FDA records and source-faithful normalized cases. Drugs, reactions, and outcomes remain separate nested collections. No all-to-all drug/reaction causal link is created.
2. **AE/ADR Master Taxonomy** preserves source reaction terms and source-provided MedDRA Preferred Terms, then adds draft internal semantic categories and relationship candidates. These derived fields remain pending qualified PV review. Official MedDRA hierarchy and codes may be added only from an authorized, versioned source.
3. **Consumer/Social Expression Library** links governed patient, caregiver, and social-language expressions to reviewed taxonomy concepts. Observed, human-authored, and model-suggested expressions remain distinguishable.
4. **PV Classifier Training Examples** stores labeled mentions, recognition spans, separate PV-relevance and ICSR-completeness assessments, routing, confidence, provenance, review, audit history, and leakage-safe dataset partitions.

### Recognition and review pipeline

```text
RAW MENTION
→ PRODUCT RECOGNITION
→ PATIENT/REPORTER RECOGNITION
→ OBSERVED EVENT RECOGNITION
→ TEMPORAL/CAUSAL CONTEXT
→ PV RELEVANCE
→ ICSR ELEMENT ASSESSMENT (P/R/D/E)
→ HUMAN REVIEW / NO ESCALATION
```

The pipeline uses two different decisions:

- **PV relevance:** whether the content should enter or remain in a safety review workflow.
- **ICSR completeness:** whether the available evidence supports an identifiable patient (P), identifiable reporter (R), suspect drug (D), and suspected event/reaction (E).

An event keyword alone is insufficient. For example, an observed statement, a question, a warning, and a negated experience that use the same event term must receive different context labels. Escalation remains a human-governed decision.

### Recommended folder structure

```text
config/pv/training-corpus/botulinum-toxin/
├── manifest.json
├── regulatory/
│   ├── manifest.json
│   ├── products-<version>.json
│   └── openfda-mapping-<version>.json
├── taxonomy/
│   ├── manifest.json
│   └── semantic-rules-<version>.json
├── expressions/
│   ├── manifest.json
│   ├── generation-templates-<version>.json
│   └── curated-seeds-<version>.json
└── schemas/
    ├── regulatory-case.schema.json
    ├── ae-adr-master-taxonomy.schema.json
    ├── consumer-social-expression.schema.json
    └── pv-classifier-training-example.schema.json

data/pv-training/regulatory/botulinum-toxin/<immutable-run-id>/
├── raw-records.jsonl
├── query-observations.jsonl
├── normalized-records.jsonl
├── malformed-records.jsonl
└── manifest.json

data/pv-training/taxonomy/botulinum-toxin/<immutable-run-id>/
├── taxonomy.json
├── taxonomy.csv
├── summaries/
└── manifest.json

data/pv-training/expressions/botulinum-toxin/<immutable-run-id>/
├── social_expression_library.json
├── social_expression_library.csv
├── quality-control-report.json
├── quality-control-report.csv
└── manifest.json

data/pv-training/examples/botulinum-toxin/<immutable-run-id>/
├── pv_training_examples.jsonl
├── pv_training_examples.csv
├── summary-report.json
├── class-distribution.csv
├── concept-coverage.csv
└── manifest.json

src/lib/pv/training/
├── regulatory/              # implemented source client, normalization, storage, CLI contracts
├── taxonomy/                # implemented draft mapping, reconciliation, and immutable output services
├── expressions/             # implemented draft generation, validation, QC, and immutable output services
├── examples/                # implemented draft contrast builder, label rules, validation, and partitioning
└── evaluation/              # future metrics, holdout, promotion, and drift controls
```

Generated corpus snapshots are intentionally outside source control. Production retention, encryption, access, and promotion remain an unresolved operational decision.

## 2. Proposed schemas

The canonical proposed JSON Schemas live in the versioned `schemas/` directory. They are validation contracts, not evidence that all datasets have been populated.

### Regulatory case

Key properties:

- Stable FAERS/openFDA identifiers and source report version.
- Source dates, seriousness criteria, patient/reporter fields when available.
- `drugs[]`, `reactions[]`, and `outcomes[]` remain separate.
- Per-drug botulinum target matching and source role.
- `causality_status = "NOT_ESTABLISHED"`.
- Query provenance, raw-record hash and location, and all configuration versions.
- Normalization warnings instead of silent imputation.

The implemented TypeScript contract is `NormalizedFaersRegulatoryCase` in `src/lib/pv/training/regulatory/types.ts`.

### AE/ADR master taxonomy concept

Key properties:

- Stable concept ID and taxonomy version.
- Preferred internal label and lifecycle state.
- One or more verbatim source terms with source record references.
- Reviewed equivalent/related mappings with rationale and confidence.
- Explicit `official_hierarchy_status`.
- Official MedDRA codes/hierarchy permitted only when source-provided or licensed and release-versioned.
- Reviewer governance and transformation provenance.

### Consumer/social expression

Key properties:

- Stable expression ID and linked taxonomy concept, normalized concept, and exact source MedDRA PT.
- Language/locale, one of ten expression types, and source of `GENERATED` or `CURATED`.
- Confidence and `pending_pv_medical_review` validation state.
- Source taxonomy snapshot/hash plus taxonomy, template, and curated-seed versions.
- Explicit statements that phrases are not official MedDRA synonyms and mappings do not establish causality.

### PV classifier training example

Key properties:

- Synthetic mention and one of eleven configured contextual or special-situation classes.
- Evidence spans for product, patient, reporter, event, and temporal/causal context.
- Separate patient, reporter, drug, event, temporal, and causality-language status.
- Controlled PV-relevance and potential-ICSR-candidate labels without final reportability language.
- Mandatory `PENDING` human-review state and explanatory reasoning label.
- Grouped train/validation/test/locked-holdout partition to prevent concept-family leakage.
- Source taxonomy and expression-library hashes plus versioned template and product-registry lineage.

## 3. Assumptions

The versioned assumption register in the project manifest is authoritative. Its current assumptions are:

1. FAERS/openFDA is a signal source; reports do not establish incidence or causality.
2. Source MedDRA Preferred Terms may be preserved, but absent official hierarchy values or codes will not be invented.
3. PV relevance and ICSR completeness are separate labels.
4. Qualified human PV reviewers remain authoritative for adjudication and escalation.
5. Every derived artifact must trace to a source record, configuration version, transformation version, and review state.
6. The initial product registry covers Botox/Botox Cosmetic/onabotulinumtoxinA, Dysport/abobotulinumtoxinA, Xeomin/incobotulinumtoxinA, Jeuveau/prabotulinumtoxinA, Daxxify/daxibotulinumtoxinA, and Letybo/letibotulinumtoxinA, and is extensible only through a new governed version.

Missing values are represented as absent or unknown, not guessed. A product match, event term, temporal expression, causal phrase, suspect-drug role, or co-occurrence can contribute evidence but cannot independently establish causality or final reportability.

## 4. Unresolved decisions

The project manifest contains the authoritative, owned decision register. The present blockers are:

1. Licensed MedDRA release and permitted hierarchy/code use.
2. Approved social sources, languages, retention rules, data rights, and permitted reuse for observed expressions.
3. Reviewer qualifications, dual-review sample, disagreement handling, and gold-label adjudication.
4. Minimum recall/precision, subgroup, and false-negative thresholds for promotion.
5. Whether and how quarterly FAERS extracts will add historical report versions and amendments.
6. Storage, encryption, access control, retention, and promotion for multi-gigabyte immutable releases.

These decisions intentionally block only the dependent phase; they do not invalidate the completed regulatory-ingestion phase.

## 5. Implementation phases

### Phase 0 — Architecture and governance foundation (complete)

Establish the versioned project manifest, four schema contracts, dependency graph, regulatory posture, assumption register, decision register, and acceptance gates.

### Phase 1 — Regulatory case ingestion (complete)

Retrieve configured target products from FDA FAERS/openFDA, stream immutable raw and normalized snapshots, preserve provenance, and quarantine malformed or identifier-conflicting records. The implementation and operating details are in `docs/pv/faers-botulinum-regulatory-corpus.md`.

### Phase 2 — AE/ADR master taxonomy (in progress; draft generated)

The source-derived inventory, stable IDs, counts, ranks, internal semantic categories, relationship candidates, summaries, and reconciliation controls are implemented. The generated taxonomy remains draft. Qualified PV review, mapping adjudication, version diffs, and retirement/redirect governance are still required before activation. The terminology license/release decision must be resolved before adding official MedDRA hierarchy.

### Phase 3 — Consumer/social expression library (in progress; draft generated)

The versioned draft builder, conservative generation profiles, supplied-example seeds, parent/provenance validation, immutable JSON/CSV outputs, and complete QC report are implemented. All 7,438 taxonomy concepts are retained, including intentionally empty expression arrays where automated expansion would be unsafe. Generated and supplied/curated candidates remain distinguishable and no concept is production-eligible. Qualified PV/medical review, rights governance for future observed social language, reviewer decisions, and controlled promotion are still required. Operating details are in `docs/pv/botulinum-social-expression-library.md`.

### Phase 4 — PV classifier training examples (in progress; synthetic draft generated)

The versioned builder now creates balanced eleven-class contrast sets for 52 important clinical concepts plus medication-error and special-situation examples. Records retain context spans, separate PV-relevance and ICSR-candidate labels, source lineage, and group-safe partitions. All 572 examples are synthetic and pending human adjudication; they are not approved training data. Operating details are in `docs/pv/botulinum-pv-training-examples.md`.

### Phase 5 — Evaluation and controlled promotion (in progress; candidate harness implemented)

A versioned 36-record gold-candidate dataset, nine required performance slices, locked false-negative regressions, reproducible binary metrics, immutable model snapshots, and an append-only primary/second/final adjudication chain are implemented. All records remain pending qualified PV adjudication, so the current figures are preliminary and cannot qualify the classifier for production. Operating details are in `docs/pv/botulinum-pv-validation-harness.md`.

### Phase 6 — Release, monitoring, and controlled updates (planned)

Promote immutable, checksummed releases; monitor drift, reviewer overrides, and false negatives; version all code-list/configuration changes; and retain rollback/replay capability without rewriting historical decisions.

## 6. Acceptance criteria by phase

The machine-readable criteria and current `met`/`pending` states are in the project manifest. In summary:

| Phase | Required outcome before exit |
| --- | --- |
| 0 | Four versioned contracts; explicit PV-vs-ICSR separation; owned assumption and decision registers. |
| 1 | Configured targets queryable; raw and nested normalized cases retained; provenance/deduplication/errors auditable; no inferred causality. |
| 2 | Stable reviewed concepts; verbatim source PTs preserved; no invented official hierarchy; mappings reversible and explained. |
| 3 | Expressions linked to reviewed concepts; origin/rights/language/confidence retained; all promoted language human-approved. |
| 4 | All eleven classes represented; P/R/D/E evidence spans retained; human adjudication captured; group leakage prevented. |
| 5 | Locked, reproducible segmented evaluation; thresholds and rollback approved; classifier only routes to human review. |
| 6 | Immutable reproducible releases; controlled version upgrades; access/retention/rollback established; drift and overrides monitored. |

No planned phase may be marked complete merely because its schema exists. Its criteria must be evidenced by automated validation plus the required PV, quality, privacy, legal, security, or model-risk approval.
