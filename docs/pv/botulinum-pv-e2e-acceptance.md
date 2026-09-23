# Botulinum toxin PV end-to-end acceptance test

## Outcome

The 2026-09-17 run exercised 56 synthetic social mentions through the complete local pipeline:

`FAERS source -> Regulatory Case Corpus -> AE/ADR Taxonomy -> Consumer Expression Library -> Social Mention Classifier -> PV Relevance Assessment -> ICSR Completeness Assessment -> E2B(R3) Mapping -> Human Review Queue projection -> Client AE/ADR Notification Object`

All 56 inputs produced retained outputs. Forty-seven examples passed every semantic expectation and nine failed at least one expectation. Thirty-nine records were routed to active human review and 17 difficult negatives were retained for audit without escalation.

The detailed machine-readable report contains all 20 requested fields for every example at `reports/pv/botulinum-toxin-e2e-acceptance-2026-09-17.json`.

## Acceptance criteria

| Criterion | Result |
| --- | --- |
| No source content silently discarded | PASS |
| Raw source preserved | PASS |
| Original social timestamp preserved | PASS |
| Generated terminology distinguished from regulatory terminology | PASS |
| AI inference distinguished from source evidence | PASS |
| Missing ICSR elements retained for human review | PASS |
| Hypothetical and negated mentions distinguished from observed events | PASS |
| Multiple drugs and events preserved as separate occurrences | PASS |
| Provenance preserved end to end | PASS |
| Human review required before final regulatory disposition | PASS |
| Classifier output auditable to exact source spans | PASS |

These governance and data-integrity criteria passing does not override the semantic failures below.

## Failures

Nine example-level failures represent three root causes:

1. Four uses of “seeing double” mapped to `Vision blurred`; the expected source-preserved FAERS taxonomy candidate was `Diplopia`.
2. Three uses of “slurred speech” mapped to `Dysphonia`; the expected source-preserved FAERS taxonomy candidate was `Dysarthria`.
3. Two declarative informational statements—one label statement and one provider warning—were correctly treated as non-observed/non-PV cases but were also marked by the hypothetical detector because they contained “can cause.”

No failed example was silently discarded, automatically finalized, or marked ready for regulatory submission.

## Remediation recommendations

1. Split diplopia/seeing-double language from blurred vision in the versioned runtime lexicon, with qualified terminology review.
2. Split dysarthria/slurred-speech language from dysphonia/voice-change language, with qualified terminology review.
3. Make hypothetical-question detection mutually distinguishable from label information and provider warnings.
4. Complete qualified PV/medical adjudication of the draft taxonomy, expression library, gold-candidate dataset, and these acceptance failures.
5. Add a generated reconciliation artifact mapping every runtime recognition term to the expression library or an explicitly governed supplemental source.
6. After semantic remediation, repeat queue persistence, role/permission, concurrency, and email-delivery tests against an isolated staging environment.

## Technical debt and readiness

- The taxonomy and consumer-expression library remain draft pending qualified review.
- Queue behavior in this suite is a deterministic local projection; no staging database records were created.
- The notification object is constrained to the approved client template, but delivery was not attempted.
- The synthetic set is English-only and does not establish real-world prevalence or production sensitivity.
- Runtime expressions are versioned, but a complete mechanical reconciliation to the generated expression artifact is not yet present.

Production-readiness assessment: **not ready for unsupervised production; suitable only for a controlled human-review pilot after the high-priority semantic defects are remediated and adjudicated.**
