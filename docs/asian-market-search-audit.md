# Asian-market Search audit

2026-10-27. Query: “What are people saying about cost and insurance in Asian markets?” GLP-1 corpus: 5,000 source rows, 4,737 retained analytical records.

The regional predicate already included Japan and South Korea. Before this change, it matched 181 retained records, including 124 South Korean and 42 Japanese records. The answer omitted market names, examples omitted country labels, and the market chart displayed only three named markets. English-first ranking also obscured native-language context.

Changes:

- Preserve coverage across East, Southeast, South, Central and West Asia. Add missing country-name aliases, including Myanmar and Palestine. APAC additionally includes Oceania; Asia alone does not.
- Add native-language cost and insurance concepts in Japanese, Korean, Chinese, Thai, Vietnamese, Indonesian/Malay, Hindi and Filipino. These are retrieval rules, not translations of quoted evidence.
- Name every matching source market and its matched topics in regional subject answers. Geography-filtered charts display all matching markets; examples include country labels and favor diversity across markets.
- Upgrade saved Search answers on opening using question-evidence version 5.

| Source market | Matching retained records |
| --- | ---: |
| South Korea | 124 |
| Japan | 46 |
| India | 10 |
| China | 5 |
| Singapore | 2 |
| Taiwan | 2 |
| Indonesia | 1 |
| Malaysia | 1 |
| Total | 191 |

These counts use the existing access-and-affordability taxonomy, including prescription access and sourcing. They are retrieval diagnostics, not independent adjudication of every post or estimates of local population concerns. Source-country metadata does not establish the location discussed in each post; overseas policy references can occur in locally published content. Markets with no matching retained evidence receive no invented findings.

Regression coverage: independent enumeration of Asian countries and territories, exclusions outside Asia, subregions/APAC, native-language fixtures, per-market chart/answer reconciliation, diverse source examples, and saved-answer refresh. Existing Search corpus, HEOR and maintenance suites also apply.
