# Botulinum toxin Consumer/Social Expression Library

## Purpose and safety posture

This versioned draft translates the source-preserved reaction concepts in the Botulinum toxin AE/ADR Master Taxonomy into candidate English language patterns that AskSocial may use to recognize potentially PV-relevant social language. It does not determine causality, incidence, ICSR completeness, or reportability.

The phrases are AskSocial training expressions, not official MedDRA synonyms or hierarchy. Every expression is marked `pending_pv_medical_review`; every concept appears in the quality-control report and is ineligible for production until qualified review and controlled promotion are complete.

## Inputs and outputs

Run:

```bash
npm run expressions:botulinum
```

The command selects the latest usable immutable taxonomy snapshot unless `--taxonomy=path` is supplied. It writes a new immutable directory beneath `data/pv-training/expressions/botulinum-toxin/` containing:

- `social_expression_library.json`: concept-oriented records with the ten required expression arrays.
- `social_expression_library.csv`: one row per expression, retaining its parent concept, exact MedDRA PT, type, source, confidence, review state, and provenance.
- `quality-control-report.json` and `.csv`: every concept requiring manual PV/medical review, reasons, and required action.
- `manifest.json`: versions, safeguards, counts, validation results, files, and limitations.

The source taxonomy file is never modified. Each mapping carries the taxonomy snapshot and SHA-256, taxonomy/configuration versions, creation timestamp, generation method, and source reference.

## Conservative generation profiles

- `clinical_high_priority`: fuller coverage for concepts ranked in the top 50 by frequency or seriousness.
- `special_situation_high_priority`: guarded phrasing for product errors, ineffective therapy, off-label use, exposure, misuse, overdose, and related non-symptom PV situations.
- `fatal_outcome_high_priority`: explicit fatal-outcome phrasing that avoids nonsensical symptom templates.
- `clinical_standard`: limited exact-concept patterns for lower-priority concepts already assigned a non-`other` internal semantic category.
- `manual_review_only`: no generated phrases for rare/ambiguous `other` concepts or lower-priority special/fatal concepts.

High-priority concepts receive at least ten lay expressions, five colloquial expressions, and five temporal expressions. Rare or ambiguous concepts receive fewer—or no—generated expressions rather than speculative expansion.

## Source and confidence

`expression_source` is always `GENERATED` or `CURATED`. In this release, `CURATED` is reserved for the Dysphagia examples supplied directly in the product requirement. Template-authored candidates are `GENERATED`. Generated straightforward language is generally medium confidence; colloquial, slang, and causal-context candidates are low confidence. Confidence describes mapping confidence, not medical causality.

## Required review

Qualified PV/medical reviewers must, at minimum:

1. confirm that each phrase remains within its parent normalized concept and exact MedDRA PT;
2. reject phrases that could materially broaden to unrelated symptoms or special situations;
3. review causal phrasing only as language recognition, never as a causality conclusion;
4. review all fatal-outcome and high-priority special-situation mappings first;
5. decide whether withheld rare concepts need carefully authored phrases;
6. record reviewer identity, decision, rationale, and configuration version through the governed promotion workflow.

This draft does not implement the subsequent PV classifier training-example phase.
