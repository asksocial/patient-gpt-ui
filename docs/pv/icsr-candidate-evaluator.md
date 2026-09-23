# AskSocial ICSR candidate evaluator

## Role in the pipeline

The evaluator runs only after PV relevance detection. It assesses whether a retained mention appears to contain the four minimum potential-ICSR elements for human PV review:

- `P`: potentially identifiable patient;
- `R`: potentially identifiable, first-hand reporter;
- `D`: suspect medicinal product;
- `E`: suspected adverse event or reaction in an observed or possibly observed context.

It does not decide causality, final regulatory reportability, or whether an ADR is confirmed. Every result retains `pv_review_required: true` and `final_determination_made: false`.

## Identifiability policy

A legal name is not required for either the patient or reporter. Existing ICH E2D(R1) §6.1 logic remains authoritative for qualifying patient characteristics, specific-patient association, reporter existence, and first-hand knowledge.

A social account may support *potential* identifiability when all of the following are preserved:

- username or handle;
- source platform;
- source URL;
- post ID;
- language indicating that the author experienced the event or has first-hand knowledge.

A handle alone never establishes identifiability. Account-context matches receive a limited confidence value, remain marked as requiring human confirmation, and carry the policy limitation in the result.

## Status and routing

The evaluator emits the requested specific status for a complete candidate or the single/multiple missing elements. It additionally emits `review_route = POTENTIAL_ICSR_MISSING_ELEMENT` for every incomplete observed candidate, ensuring that incomplete content is retained for follow-up rather than discarded.

Non-observed contexts and medication-error/special-situation content retain recognized product/event terminology but use their respective review statuses. Candidate product/event evidence must be present in the original mention and pass the configured confidence threshold.

## Provenance

The result preserves, without rewriting:

- username/handle;
- source platform and URL;
- post ID;
- original post timestamp;
- collection timestamp;
- algorithm timestamp;
- human review timestamp;
- escalation timestamp.

Human-review and escalation timestamps remain `null` until those actions occur.

The versioned policy is in `config/pv/icsr-candidate-evaluator/manifest.json`; the implementation is `src/lib/pv/icsrEvaluator.ts`.
