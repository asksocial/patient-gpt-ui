# Module context audit — October 27, 2026

Audited all seven intelligence modules against all six configured analytical
corpora: GLP-1, Botulinum toxin, Medical Aesthetics, Hepatitis B, Gene Therapy,
and Regenerative Aesthetics. This is 42 available module/corpus combinations.
Uterine Fibroids has no configured corpus (seven unavailable combinations), so
its relevance cannot be assessed; the platform must continue to show unavailable
evidence rather than invent results.

## Reproducible findings and fixes

- Generated claims, taxonomy labels and source/platform metadata could create
  apparent topic matches. Matching now uses preserved original text, removes
  known posting instructions and URLs, and prevents inherited parent titles from
  establishing a commenter's signal. Original source text remains preserved.
- English substrings could match inside unrelated words. Bounded matching now
  rejects cases such as `site` in `website`, `cost` in `costume`, and `work` in
  `network`. Source-level positive and negative fixtures cover these cases.
- Shared topic rules now include native-language signals found in the corpora,
  including Korean and Japanese treatment questions, dosing, costs, tolerability,
  research and comparison language, with additional concepts in other languages.
  This is improved vocabulary coverage, not a claim of complete language recall.
- Finding eight preferred sources previously discarded other eligible sources.
  Preferences now rank evidence. Standard-module reports include source-policy-
  eligible topic matches, including explicitly labeled lower-quality context.
  High confidence requires quality-qualified support; lower-quality-only matches
  remain directional. Medical/Clinical/Advocacy source exclusions remain enforced; Commercial and
  Competitive keep promotional context labeled. Dedicated pre-qualified Clinical
  Trials records remain retained, quality-ranked and fully reviewable.
- Current GLP-1 commercial, clinic and influencer roles now also update their
  evidence classes, promotional flags and class-specific quality caps, preventing
  older news classifications from bypassing module source exclusions.
- Trial-specific recruitment, eligibility, retention, site and trust signals now
  require research context. Routine medication, safety and outcome discussions
  remain clearly labeled design context and do not establish trial participation.
- Patient signals now use the same source-grounded, multilingual matching in
  summary counts and evidence tables. Maintenance shares the audited Search
  concept vocabulary. Outcomes are not automatically called uncertainty, topic
  mentions are labeled treatment considerations, and unmet-information needs
  require an explicit question or need. Empty evidence does not produce invented
  priorities or recommendations. Patient voice/source-role gates are preserved.
- Representative excerpts preserve Unicode during deduplication and allocate an
  example to each supported section before filling the 16-example display limit.
  This display limit does not cap analysis or the paginated evidence corpus.
- Evidence tables default to module-related mentions under the same topic/source
  rules as reports; an explicit All retained corpus option preserves access to
  the wider source universe. All-source records are not treated as module matches.

## GLP-1 comparison

All modules still receive all 4,737 retained analytical findings. Patient scope
remains 634 patient-related mentions (277 in the narrower voice-only scope).
The specialist counts below represent unique records matching at least one
module topic, not unique people or independently validated claims. Topic counts
within a module can overlap. The Patient row is its eligible scope, not a count
of records containing a particular signal.

| Module | Input findings | Previous matched context | Audited matched context |
| --- | ---: | ---: | ---: |
| Patient | 4737 | 634 in patient scope | 634 in patient scope |
| Medical Affairs/HEOR | 4737 | 23 | 1120 |
| Clinical Trials | 4737 | 43 | 1673 |
| Corporate Affairs | 4737 | 480 | 1209 |
| Commercial | 4737 | 2119 | 2001 |
| Competitive | 4737 | 1425 | 1009 |
| Advocacy | 4737 | 528 | 936 |

Counts can rise through recovered context or fall when weak/unrelated matches
are removed. They are audit diagnostics, not measured precision/recall against a
human-adjudicated gold standard. The [complete matrix](module-context-audit.csv)
and [section/source audit](module-context-audit-sources.json) cover all available
module/corpus combinations. Human review remains necessary for ambiguous,
quoted, promotional, translated or truncated material.

## Verification and reproduction

`npm run test:module-context` checks source-only matching, native-language
positives, substring negatives, research-context gates, scoped/full catalogs,
Patient needs, empty results, Unicode deduplication and section representation.
The GLP-1 corpus checks reconcile all specialist scoped catalog totals to report
counts and retain Patient scope. The dedicated Clinical Trials corpus checks
retain 4,850 analytical records and all source-class/quality labels. Existing
Patient product/classifier, specialist generation, Search maintenance and loading
checks, lint, type checking and the production build also pass.

Run `tsx scripts/audit-module-context.ts` to re-audit every configured module and
assert complete input accounting and representative section coverage. The JSON
output defaults to `/private/tmp/module-context-latest.json`; `AUDIT_OUTPUT` can
choose another audit output path. Original exports and PV screening/detection
rules are unchanged. New or regenerated reports use `source_context_v2`; saved
historical report payloads remain preserved.
