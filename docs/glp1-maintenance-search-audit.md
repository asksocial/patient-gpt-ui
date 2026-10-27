# GLP-1 maintenance Search audit — October 27, 2026

Question: “What are patients saying about maintenance?”

The current export contains 639 patient-related source mentions; 634 survive
analytical corpus filters. Search evaluates the whole shared corpus before
applying the requested patient-content and subject filters. There is no 36-row
retrieval cap. The previous topic rules selected 36 source and analytical rows.

The audit scanned available export text and reviewed candidate matches in the
original languages. It found missed dose-reduction/spacing accounts, stopping
and regain language, and weight plateaus during continued treatment. The
maintenance umbrella follows the platform’s Maintenance & Discontinuation scope;
plateaus are labeled separately from achieved weight maintenance.

Updated selection: **48 source mentions / 48 retained analytical mentions**.
Fifteen newly captured rows and three removed rows reconcile the original 36.
The removed matches concerned maintaining cardiovascular fitness, maintaining
lifestyle habits in a discussion of a different medication, and starting an
increased dose without a treatment break. Native-language patterns now require
more relevant context; known forum posting instructions are stripped from the
matching text so their example topics do not qualify unrelated posts.

| Matched topic | Mentions |
| --- | ---: |
| Maintenance and continued use | 18 |
| Weight plateaus during continued treatment | 11 |
| Stopping and treatment breaks | 11 |
| Weight regain | 8 |
| Restarting treatment | 3 |
| Dose reduction and spacing | 2 |

Topics overlap; their counts must not be summed as unique posts. The adjacent
[CSV](glp1-maintenance-search-audit.csv) lists each of the 48 selected source IDs,
original URLs, languages and matching topics. Regenerate it with
`tsx scripts/audit-glp1-maintenance.ts`.

This is an auditable retrieval count from the export’s available titles and
snippets, not a verified number of unique patients or a human-adjudicated estimate
of perfect semantic recall. Patient-related material includes support-community
and reported accounts. Titles can provide conversation context for comments;
this does not establish that every commenter personally had the experience.
Uncollected or truncated source text cannot establish additional matches.

`npm run test:search-maintenance` checks positive and negative language fixtures,
previously missed original URLs, template exclusions, and saved Search refresh.
Question-evidence version 4 refreshes saved results on open without rewriting the
stored messages. The corpus and the Patient module’s 634-record scope are unchanged.
