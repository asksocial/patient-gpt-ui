# Shared Search corpus intelligence

Search uses the same components and pipeline for every therapeutic area and corpus. There is no GLP-1 condition in Search routing or rendering. Existing specialized GLP-1 attribution rules remain a classifier strategy; other topics use their configured disease profile and shared source-role attribution.

- `loadSearchCorpusIntelligence` reads raw source files from the canonical corpus registry and complete canonical records for curated or imported data. Dynamically discovered CSV topics automatically participate. New corpora do not require a frontend change.
- Raw source rows, including excluded rows, determine source composition. The full retained corpus determines burden and market charts. Counts never come from the final ranked evidence shortlist.
- Generic labels distinguish source posts from curated/mixed records. Extra thematic exclusions outside GLP-1 are called “other filtered posts/records”; their reason is not assumed to be spam or promotion.
- The same six exclusive client groups, separate off-topic bucket, combined patient-related group, stacked persona bar, drill-downs, centered leading shares and chart header styling apply everywhere.
- The Search analytical answer is qualitative. Search hides `strategic_implications` / “What This Means” analytical sections and removes the separate hybrid synthesis card. Other products retain their upstream synthesis data.

## Question scope

`selectSearchCorpusForQuestion` applies supported question facets before theme assignment, evidence selection or ranking. Facets include configured symptom/treatment language, source countries and regions (including Asia, Asian markets, Asian subregions and APAC), audience roles, platforms, and shared access, safety, education, research, policy and commercial concepts. Multiple values within a dimension are alternatives; independent dimensions combine. Source attribution and topic-specific terminology come from the corpus and its configured profile. Broad overview prompts retain the overall corpus view.

For a focused question:

- Source composition uses every matching source row, including excluded rows; analytical charts use every matching retained record.
- A visible Question focus panel and chart subtitles identify the cohort and denominator.
- Overall source composition remains available through a closed “View overall corpus composition” disclosure. It is never added to or confused with the matching cohort.
- Canonical evidence, source mentions, source-derived themes, mode analysis and the hybrid answer receive the matching evidence. Precomputed topic-wide themes and relationships do not replace scoped evidence.
- Unresolved meaningful qualifiers are applied as literal text filters (all remaining terms must match), including alongside recognized facets. Broad words such as “themes” or “emerging” cannot discard a geographic or topical constraint. An unsupported specific concept yields an empty cohort and an explicit lack-of-evidence answer; it does not silently reuse the overall totals.

Facets are deterministic and based on available text/metadata, rather than unrestricted natural-language inference. Different phrasings that request the same scope can appropriately have the same denominators. Temporal comparisons still require the longitudinal evidence pipeline; an overall corpus chart is not a claim of a live change.

## Saved conversations

On read, Search upgrades presentation from the saved question and the current registered topic corpus. The immediately preceding user message supplies the question for older reports; newer scoped summaries also carry their question context. Stored messages and original evidence are not modified. Authorization, entitlements and session ownership checks remain in place.

## Validation

`npm run test:search-corpus` checks every configured corpus, a new CSV topic without a registry entry, a custom imported corpus, exclusive persona reconciliation, complete donut totals, the ranked-50 boundary, qualitative summaries, country/cost/safety question differences, no-match behavior, and read-only saved-question refresh. The check is included in `test:production`.

## One current response

The Search page renders a single response selected by `getCurrentSearchResult`, rather than mapping the complete transcript into stacked answers. Submitting a new question clears the previous response from the view while loading; the new result replaces charts, narratives, evidence and actions together. A failed request shows its error without presenting the previous question's data as current. The header follows the latest submitted question, not the original conversation title or an unsubmitted draft. Persisted messages remain intact, and reopening a conversation selects its latest question/response pair.


## Geographic and temporal interpretation

Regions expand to explicit country membership before any ranking. Asian markets means source countries in East, Southeast, South, Central and West Asia; APAC also includes Oceania. This is source-market metadata, not inferred ethnicity, residence or the country mentioned in a post. Missing country metadata does not qualify. Country names and common aliases are recognized even when that country has no records, yielding an honest empty cohort. Existing saved questions are re-scoped on read.

An emerging-theme question receives the requested geographic/topic cohort and a qualitative statement that themes present in a corpus do not establish newness or growth without a time comparison. This matcher does not claim unrestricted language understanding: unresolved specific language is matched literally, and absent evidence produces an explicit no-match result rather than a broad fallback. More complex analyses still need a supported analysis pipeline or clarification.


## HEOR question readiness

Focused subject answers use `searchSubjects` and `buildQuestionEvidence`, rather than reusing symptom counts inside a cost/access or dosing cohort. Shared subject concepts cover access, safety, appetite/daily life, maintenance, dosing, women's health, household economics, education, outcomes, research, policy and commercial questions. Supported native-language patterns improve recall without translating or rewriting evidence. These are deterministic discussion-topic matches, not validated patient prevalence or unlimited natural-language interpretation.

The analytical narrative is qualitative and references only discussion topics observed in matching retained records. It states relevant research uses and limits; thin cohorts are illustrative, and requests for rates, average costs or productivity estimates explicitly require a suitable denominator and structured measurements. Temporal and causal questions receive corresponding limits.

`Topics in This Question` replaces the symptom-burden chart for supported subject questions. It partitions matching retained records into leading topic-only slices, their overlap and a remainder; market/source composition keeps its existing denominators. Original excerpts and source links appear beside the answer, with English examples first when available. No translation is invented. Supporting conversation topics and research actions use the same grounded evidence; no generated emergence claims are added. The selection and synthesis refresh existing saved answers as well as new questions without altering stored messages.

`npm run test:heor-search` is included in the production regression suite. It checks the rehearsal prompts, exact source excerpts, topic chart reconciliation, saved refresh, native-language retrieval, thin/no-match cases, unsupported rates, temporal limits and a future custom corpus. This validates software behavior, not clinical truth, representativeness, complete language coverage or a formal research instrument.
