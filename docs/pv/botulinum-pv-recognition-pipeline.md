# Botulinum toxin PV recognition pipeline

## Purpose and boundary

The production recognizer identifies botulinum-toxin social mentions that may require pharmacovigilance review. It does not establish medical causality, validate MedDRA coding, or make a final regulatory-reportability decision. Routed output uses the statement `PV review required`.

The active pipeline version is `btx-pv-recognition-2026.01.0`. Its manifest and runtime event lexicon are in `config/pv/recognition/botulinum-toxin/`. Published versions are intended to be immutable; a changed product registry, taxonomy mapping, expression library, context rule, special-situation rule, or threshold requires a new version.

## Fourteen stages

1. `product_recognition` matches versioned brands and active ingredients while excluding configured metaphorical uses.
2. `patient_reporter_evidence` extracts first-person, first-hand third-party, second-hand, patient-characteristic, multiple-patient, and ambiguous-pronoun evidence.
3. `observed_event_detection` detects candidate experiences and classifies their context as observed, possibly observed, negated, hypothetical, informational, anticipated, or historically unrelated.
4. `event_normalization` preserves the source phrase and maps it to an internal normalized concept.
5. `meddra_candidate_mapping` preserves the FAERS-derived PT exactly as a candidate requiring human validation.
6. `temporal_relationships` captures after, since, before, and stated onset intervals.
7. `causality_language` distinguishes reported attribution, possible attribution, temporal-only association, and denied attribution.
8. `negation_detection` applies scoped negation to an event; uncertainty language such as “not sure if” is not treated as negation.
9. `hypothetical_detection` separates questions, information/warnings, anticipated events, and unrelated history from observed experiences.
10. `third_party_detection` distinguishes first-hand reports about another person, second-hand reports, and ambiguous pronouns.
11. `special_situations` detects the versioned overdose, extra-dose, wrong-product, misuse, off-label, accidental/occupational exposure, pregnancy/breastfeeding exposure, lack-of-efficacy, and product-quality rules.
12. `pv_relevance` assigns `HIGH`, `MEDIUM`, `LOW`, or `NONE` using combined evidence rather than a single keyword.
13. `icsr_element_assessment` invokes the post-relevance P/R/D/E evaluator and retains missing elements instead of discarding an incomplete mention.
14. `human_review_routing` routes potential ICSR, missing-element, special-situation, or general PV-triage work; non-observed content is retained for audit without escalation.

## Provenance and persistence

Every result preserves the original mention, source, source URL, source ID, source and collection timestamps, algorithm timestamp, author identifier when available, all version identifiers, exact character-offset evidence spans, normalized concepts, confidence, and human-review state. The complete structured result is retained under `ae_ontology.recognitionPipeline` when the record is stored through the existing PV persistence layer. The adapter also produces the legacy detection fields needed by the current Review Queue.

Direct PV ingestion selects this recognizer when the active library is scoped to the `Botulinum toxin` topic or its product ID is `botulinum_toxin`. Other topics retain their current classifiers. Bundled botulinum corpus selection and persistence use the same versioned recognizer.

## Runtime data policy

The product registry and its versioned human-readable active-ingredient alias layer are active. The full generated taxonomy, social-expression library, and contrast-training examples remain draft pending qualified PV/medical review. Production matching therefore uses a deliberately bounded runtime lexicon made from preserved FAERS PTs plus explicit AskSocial recognition phrases. A source phrase equal to the MedDRA PT is marked `FAERS_TAXONOMY`; lay, colloquial, or misspelled phrases are marked `SOCIAL_EXPRESSION_LIBRARY`. Neither provenance value implies an official MedDRA synonym relationship.

## Confidence and routing

- `HIGH`: product, observed patient experience, event, and supporting context are clear.
- `MEDIUM`: a likely observed event or governed special situation is present but evidence is incomplete or ambiguous.
- `LOW`: product/event or nonspecific harm context is weak; the mention remains in PV triage and cannot become a complete ICSR merely from the score.
- `NONE`: the supported event is hypothetical, informational, negated, anticipated, historically unrelated, or no relevant product/context is present.

Potentially serious event concepts and explicit seriousness evidence receive a minimum medium relevance and critical review priority when the event is observed or possibly observed. This is a routing safeguard, not a seriousness or reportability determination.

## Known limitations

- Phrase/rule matching is intentionally deterministic and auditable; it is not a substitute for qualified clinical interpretation.
- The active event lexicon is smaller than the draft FAERS taxonomy because unreviewed generated expressions are not promoted automatically.
- Thread context is preserved by the enclosing PV record but is not yet jointly classified with the primary mention.
- Sarcasm, cross-post references, code-switching, and novel slang can remain ambiguous and should be addressed through monitored false-negative review and versioned rule promotion.
- MedDRA PTs are candidates only; qualified human coding remains required.

## Verification

Run:

```bash
npm run test:botulinum-pv-recognition
npm run test:botulinum-toxin-pv
npm run test:icsr-candidate-evaluator
```

The focused suite covers positive and difficult-negative cases, hypothetical and negated language, ambiguous pronouns, multiple drugs and patients, third-party/second-hand reports, slang, misspellings, emojis, fragmented language, special situations, explicit seriousness, exact evidence offsets, source/timestamp preservation, and absence of a final regulatory determination.
