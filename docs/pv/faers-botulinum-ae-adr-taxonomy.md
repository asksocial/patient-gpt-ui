# Botulinum toxin FAERS AE/ADR master taxonomy

## Scope and regulatory posture

This pipeline builds a draft AskSocial training taxonomy from every source-provided reaction MedDRA Preferred Term in a complete normalized botulinum toxin FAERS/openFDA corpus snapshot.

The output describes reactions **reported in association with FAERS cases containing a target product**. Frequency, seriousness, product breadth, or suspect-drug designation does not establish that a botulinum toxin product caused a reaction. The taxonomy does not calculate incidence, make a causality determination, or replace human PV review.

Internal AskSocial semantic categories and concept relationships are not official MedDRA hierarchy. Source `meddra_pt` values remain verbatim and are never replaced by normalized labels.

## Versioned configuration

- `config/pv/training-corpus/botulinum-toxin/taxonomy/manifest.json`
- `semantic-rules-2026.01.0.json`
- `config/pv/training-corpus/botulinum-toxin/schemas/ae-adr-master-taxonomy.schema.json`

The rules file controls category patterns and a small set of explicit internal concept mappings. Presentation-only duplicates are proposed when two exact source PT strings normalize to the same case-, punctuation-, Unicode-, and whitespace-normalized label. Every relationship remains `algorithmic_candidate_pending_pv_review`.

## Build command

```bash
npm run taxonomy:botulinum
```

Optional immutable paths:

```bash
npm run taxonomy:botulinum -- \
  --source-dir=data/pv-training/regulatory/botulinum-toxin/<snapshot> \
  --output-dir=data/pv-training/taxonomy/botulinum-toxin/<new-snapshot>
```

The builder automatically selects the latest complete, untruncated regulatory snapshot when `--source-dir` is omitted. It streams `normalized-records.jsonl`, hashes the source while reading, and refuses to overwrite an existing output directory.

## Record model

Each taxonomy record includes:

- Exact `meddra_pt`, internal `normalized_label`/`normalized_concept`, stable concept and group IDs.
- Source reaction-occurrence, unique case, and unique safety-report counts.
- Serious, non-serious, and unknown-seriousness case counts.
- Target products, active ingredients, first/last observed source dates, and example case IDs.
- Frequency, seriousness, product-breadth, and unique-case ranks.
- Primary and secondary AskSocial semantic categories.
- Draft related-concept candidates with rationale and confidence.
- Source snapshot, input hashes, source configuration versions, taxonomy-rule version, MedDRA versions, generation time, and the non-causality association statement.

Unknown seriousness is retained separately so that `serious + non-serious + unknown` always reconciles to the source-case count for each term.

## Outputs

Each immutable snapshot contains:

- `taxonomy.json`
- `taxonomy.csv`
- `manifest.json`
- `summaries/top-50-reactions-overall.{json,csv}`
- `summaries/top-serious-reactions.{json,csv}`
- `summaries/reactions-by-product.{json,csv}`
- `summaries/reactions-by-active-ingredient.{json,csv}`
- `summaries/reactions-by-indication.{json,csv}`

Association summaries count a reaction once per source case and association value. Because a report can contain multiple products, reactions, or indications, these summaries do not imply pairwise causality.

## Complete snapshot results

Source snapshot: `2026-09-16T19-27-12-044Z`

Generated taxonomy snapshot: `2026-09-16T22-15-00-000Z`

- Unique exact reaction PTs: **7,438**
- Source cases read: **97,304**
- Serious source cases: **21,972**
- Non-serious source cases: **75,318**
- Cases with unknown seriousness: **14**
- Cases missing reaction terminology: **0**
- Valid reaction occurrences: **350,169**
- Case reconciliation: passed
- Seriousness reconciliation: passed
- Reaction-occurrence reconciliation: passed

## Validation behavior

- A malformed JSON line stops the build with the line number.
- A duplicate normalized case ID stops the build instead of silently dropping it.
- The number of source lines must equal the normalized count declared by the source manifest.
- Cases with no valid PT are counted as missing rather than discarded.
- The exact set of source PT strings must equal the generated taxonomy PT set in fixture tests.
- All reaction occurrences must reconcile to the sum across taxonomy records.
- Published output paths are immutable.

## Limitations

- FAERS spontaneous reports cannot establish incidence or causality.
- A case can contain several products, reactions, and indications without supported pairwise relationships.
- Counts may reflect follow-up versions where the source provides multiple versions; unique safety-report counts remain separate from versioned case counts.
- openFDA generally provides the latest report version; historical amendments may require quarterly FAERS extracts.
- Internal semantic categories are deterministic keyword-based training aids, not clinical or MedDRA hierarchy assignments.
- Relationship candidates include conservative presentation-normalized duplicates and a small versioned mapping set; they require PV adjudication.
- Source values may differ in casing or presentation across FAERS versions. These remain distinct `meddra_pt` records even when grouped under one internal concept.
- Missing terminology is not inferred or imputed.
- Consumer/social expression generation is deliberately out of scope for this phase.
