# Botulinum toxin PV-recognition training examples

## Purpose and status

This versioned dataset teaches AskSocial to distinguish an observed experience from uncertain causality, hypothetical or feared events, explicit negation, general information, provider warnings, temporally unrelated history, insufficient information, and medication-error/special-situation language.

Every record is synthetic, marked `PENDING`, and requires qualified human assessment. Labels identify potential PV relevance and potential ICSR candidacy; they do not determine causality or final regulatory reportability. There are no externally validated human adjudications in this draft.

## Generation

Run:

```bash
npm run examples:botulinum
```

The command uses the latest usable immutable Consumer/Social Expression Library snapshot unless `--expression-library=path` is supplied. It writes a new immutable snapshot beneath `data/pv-training/examples/botulinum-toxin/`.

Outputs:

- `pv_training_examples.jsonl`: one complete structured record per line.
- `pv_training_examples.csv`: the same records in tabular form.
- `summary-report.json`: class, PV relevance, ICSR-candidate, product, split, concept, and special-situation coverage.
- `class-distribution.csv`: class balance.
- `concept-coverage.csv`: contrast-set coverage and leakage-safe partition assignment for each important AE concept.
- `manifest.json`: versions, lineage, validation, files, and limitations.

## Contrastive design

The current draft selects 52 high-priority clinical concepts from the source-linked expression library. Each concept receives ten examples using the same event wording:

1. observed self-report;
2. observed first-hand third-party report;
3. possible event with uncertain causality;
4. hypothetical question;
5. anticipated or feared event;
6. negated event;
7. general information;
8. provider warning;
9. historical or unrelated event;
10. insufficient information.

Each contrast group therefore contains two observed positives and six difficult negatives using the same event terminology, plus uncertain and insufficient-information cases. The entire group remains in one dataset partition.

An additional 52 examples balance the eleventh class across overdose, extra dose, wrong product, misuse, off-label use, accidental exposure, occupational exposure, pregnancy exposure, breastfeeding exposure, lack of efficacy, and product quality concerns.

## ICSR and context labels

The flat record contract separately captures patient, reporter, drug, and event status. `COMPLETE_POTENTIAL_ICSR` is permitted only when the synthetic text contains one specific patient with a qualifying characteristic, an identifiable first-hand reporter, a target product, and an observed event. It still means only “potential ICSR candidate” and requires human assessment.

The generator validates:

- exact class balance;
- source concept and expression-library lineage;
- event and product evidence spans;
- contextual label consistency;
- a minimum of three hard negatives per positive;
- same-term contrast sets;
- stable concept-group partitioning with no cross-split leakage;
- absence of final-reportability or confirmed-ADR language;
- mandatory human review for every record.

## Required next review

Before any training or evaluation promotion, qualified reviewers must verify clinical and contextual fidelity, ICH-aligned P/R/D/E labels, special-situation routing, false-negative risks, and the appropriateness of generated general-information statements. PV Quality must then approve the adjudicated dataset version and locked holdout policy.
