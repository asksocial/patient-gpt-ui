# Therapeutic-area onboarding contract

AskSocial’s intelligence, module, workflow, workspace, governance, and PV engines are shared platform services. A therapeutic area supplies data and optional precision enhancements; it does not receive a separate implementation of those services.

## Minimum onboarding

1. Add and activate the therapeutic area in Administration, then assign it to permitted users.
2. Supply a canonical Meltwater CSV using the filename `data/<therapeutic-area-slug>.csv`, for example `data/migraine.csv` or `data/non-small-cell-lung-cancer.csv`.
3. If a module has a dedicated corpus, use `data/<therapeutic-area-slug>-<module-slug>.csv`, for example `data/migraine-clinical-trials.csv`.
4. Run lint, TypeScript, `test:therapeutic-area-framework`, the complete production suite, and the production build.

The generic ingestion profile, evidence-ranking profile, and theme taxonomy provide immediate baseline support. Search, Executive Brief, Knowledge Graph, Patient Intelligence, every non-patient module, intelligence-mode analysis, monitoring, workspaces, reporting, and governed workflows continue to use the same output and evidence contracts.

## Optional precision enhancements

Add an area-specific ingestion profile, ranking profile, or theme taxonomy when validated domain language is available. These extensions should improve recall or precision without changing shared output schemas, evidence rules, source traceability, confidence scoring, entitlements, or workflow controls.

## PV Compliance onboarding

PV Compliance is configuration-driven for every therapeutic area:

1. Create a therapeutic-area-scoped detection library.
2. Add product/procedure concepts and relevant aliases.
3. Add adverse-experience and special-situation concepts, including medication error, overdose, misuse/abuse, pregnancy exposure, lack of efficacy, and product-quality complaints as applicable.
4. Add exclusions, expected label events, markets, languages, active dates, and sponsor-approved thresholds.
5. Approve and activate the versioned library before ingestion.
6. Ingest governed source content using the selected therapeutic area and active library.

Product-linked AE/ADR detections enter the Review Queue. Product-linked special situations without an AE/ADR signal enter Health Experience Detection. Detection is never an automated case determination. ICSR minimum criteria, patient and reporter identifiability, Day Zero, structured review, sponsor handoff, audit/provenance, and reconciliation use the same controlled workflow for every therapeutic area.

Area-specific bundled synchronization endpoints are optional deployment conveniences only. They must call the same governed PV services and must not create a separate compliance workflow.
