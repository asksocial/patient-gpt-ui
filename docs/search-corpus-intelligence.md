# Shared Search corpus intelligence

Search uses the same components and pipeline for every therapeutic area and corpus. There is no GLP-1 condition in Search routing or rendering. Existing specialized GLP-1 attribution rules remain a classifier strategy; other topics use their configured disease profile and shared source-role attribution.

- `loadSearchCorpusIntelligence` reads raw source files from the canonical corpus registry and complete canonical records for curated or imported data. Dynamically discovered CSV topics automatically participate. New corpora do not require a frontend change.
- Raw source rows, including excluded rows, determine source composition. The full retained corpus determines burden and market charts. Counts never come from the final ranked evidence shortlist.
- Generic labels distinguish source posts from curated/mixed records. Extra thematic exclusions outside GLP-1 are called “other filtered posts/records”; their reason is not assumed to be spam or promotion.
- The same six exclusive client groups, separate off-topic bucket, combined patient-related group, stacked persona bar, drill-downs, centered leading shares and chart header styling apply everywhere.
- The Search analytical answer is qualitative. Search hides `strategic_implications` / “What This Means” analytical sections and removes the separate hybrid synthesis card. Other products retain their upstream synthesis data.

## Question scope

`selectSearchCorpusForQuestion` applies supported question facets before theme assignment, evidence selection or ranking. Facets include configured symptom/treatment language, source countries, audience roles, platforms, and shared access, safety, education, research, policy and commercial concepts. Multiple values within a dimension are alternatives; independent dimensions combine. Source attribution and topic-specific terminology come from the corpus and its configured profile. Broad overview prompts retain the overall corpus view.

For a focused question:

- Source composition uses every matching source row, including excluded rows; analytical charts use every matching retained record.
- A visible Question focus panel and chart subtitles identify the cohort and denominator.
- Overall source composition remains available through a closed “View overall corpus composition” disclosure. It is never added to or confused with the matching cohort.
- Canonical evidence, source mentions, source-derived themes, mode analysis and the hybrid answer receive the matching evidence. Precomputed topic-wide themes and relationships do not replace scoped evidence.
- An unsupported specific concept yields an empty cohort and an explicit lack-of-evidence answer; it does not silently reuse the overall totals.

Facets are deterministic and based on available text/metadata, rather than unrestricted natural-language inference. Different phrasings that request the same scope can appropriately have the same denominators. Temporal comparisons still require the longitudinal evidence pipeline; an overall corpus chart is not a claim of a live change.

## Saved conversations

On read, Search upgrades presentation from the saved question and the current registered topic corpus. The immediately preceding user message supplies the question for older reports; newer scoped summaries also carry their question context. Stored messages and original evidence are not modified. Authorization, entitlements and session ownership checks remain in place.

## Validation

`npm run test:search-corpus` checks every configured corpus, a new CSV topic without a registry entry, a custom imported corpus, exclusive persona reconciliation, complete donut totals, the ranked-50 boundary, qualitative summaries, country/cost/safety question differences, no-match behavior, and read-only saved-question refresh. The check is included in `test:production`.

## One current response

The Search page renders a single response selected by `getCurrentSearchResult`, rather than mapping the complete transcript into stacked answers. Submitting a new question clears the previous response from the view while loading; the new result replaces charts, narratives, evidence and actions together. A failed request shows its error without presenting the previous question's data as current. The header follows the latest submitted question, not the original conversation title or an unsubmitted draft. Persisted messages remain intact, and reopening a conversation selects its latest question/response pair.
