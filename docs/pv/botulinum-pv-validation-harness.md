# Botulinum toxin PV validation harness

## Status and intended use

The harness is a governed evaluation and adjudication foundation for the AskSocial botulinum toxin PV classifier. Its candidate dataset is synthetic, compact, and awaiting manual adjudication by a PV-qualified reviewer. Results produced before that review are explicitly marked `PRELIMINARY_NOT_FOR_PRODUCTION_QUALIFICATION` and must not be used as evidence of regulatory validation or deployment readiness.

The manifest pins the classifier, taxonomy, expression-library, and dataset versions used in every evaluation run. Model outputs are stored as immutable snapshots; later human decisions are appended as separate events and never replace the historical model decision.

## Evaluation dataset and measures

The candidate gold-standard dataset contains 36 balanced records: 18 seeded positive references and 18 seeded negative references. Every record remains `PENDING_PV_REVIEW` until a qualified reviewer adjudicates it. The harness reports:

- sensitivity/recall, specificity, precision, false-positive rate, false-negative rate, and F1;
- true-positive, true-negative, false-positive, and false-negative counts;
- separately calculated results for serious-event concepts, negated events, hypothetical statements, third-party reports, missing ICSR elements, special situations, colloquial language, misspellings, and fragmented social posts; and
- disagreement and unadjudicated-record lists for reviewer follow-up.

Three metric bases are supported:

- `PROVISIONAL_BASELINE` uses seeded evaluation-design labels and is suitable only for harness development.
- `ADJUDICATED_ONLY` excludes every record without a final human decision and is the required basis for qualified performance reporting.
- `HUMAN_WHEN_AVAILABLE` uses final human decisions when available and provisional labels otherwise; it remains preliminary while any records are unadjudicated.

The initial provisional-baseline run produced 17 true positives, 14 true negatives, 4 false positives, and 1 false negative: recall 0.944444, specificity 0.777778, precision 0.809524, false-positive rate 0.222222, false-negative rate 0.055556, and F1 0.871795. These figures characterize the seeded candidate set, not real-world or production performance.

## Qualified adjudication workflow

1. Generate an immutable evaluation snapshot with `npm run evaluate:botulinum-pv -- --output <new-directory>`.
2. Give the generated `adjudication-worksheet.csv`, source text, model evidence spans, and applicable review procedures to a PV-qualified reviewer.
3. Record a `PRIMARY_REVIEW` event using one of the controlled reviewer labels: `TRUE_PV_CANDIDATE`, `POSSIBLE_PV_CANDIDATE`, `NON_CASE`, `INSUFFICIENT_INFORMATION`, `SPECIAL_SITUATION`, or `NEEDS_SECOND_REVIEW`.
4. Require reviewer identity, qualification attestation, notes, and timestamp. A `NEEDS_SECOND_REVIEW` decision must receive a distinct qualified `SECOND_REVIEW` event.
5. Require second review when the proposed final decision differs from the primary decision or when reviewers disagree.
6. Append a `FINAL_ADJUDICATION` event. Final decisions cannot use `NEEDS_SECOND_REVIEW` and cannot be rewritten.
7. Recalculate with `ADJUDICATED_ONLY`. Production qualification remains prohibited until all records are finally adjudicated and the PV-approved thresholds and promotion gates are documented.

The audit sequence is retained as:

`ORIGINAL_MODEL_DECISION -> PRIMARY_REVIEW -> SECOND_REVIEW (when required) -> FINAL_ADJUDICATION`

Each event includes classifier and taxonomy versions, the contemporaneous model decision, reviewer decision, disagreement state, notes, timestamp, prior-event hash, and event hash.

## False-negative regression protection

Nine locked regression examples cover serious language, third-party reports, missing ICSR elements, colloquialisms, misspellings, fragmented posts, uncertain causality, and special situations. A regression passes only when it remains routed for PV review. Previously identified false negatives should be added as new versioned records; existing records and historical results must not be overwritten.

## Files

- `config/pv/evaluation/botulinum-toxin/manifest.json` — version pins, labels, metric definitions, and thresholds.
- `config/pv/evaluation/botulinum-toxin/gold-candidate-2026.01.0.json` — candidate adjudication set.
- `config/pv/evaluation/botulinum-toxin/false-negative-regressions-2026.01.0.json` — locked regressions.
- `config/pv/evaluation/botulinum-toxin/schemas/` — machine-readable record and event contracts.
- `src/lib/pv/evaluation/` — evaluation, metrics, adjudication, integrity, and storage implementation.
- `src/test/runBotulinumPvValidationHarnessQuality.ts` — harness and regression controls.

## Known limitations and next gate

The candidate set does not yet represent prevalence, platform mix, languages, product distribution, or post-market case complexity. It is not a substitute for an independently sampled locked holdout set. The next manual requirement is qualified PV adjudication, followed by documented error review, approved decision thresholds, slice-specific acceptance criteria, and controlled promotion approval.
