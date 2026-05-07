# Disease Profile Authoring Guide

Each disease-state profile should follow the same structure and live in:

`src/ingestion/profiles/`

Examples:
- `hepatitisBProfile.ts`
- `uterineFibroidsProfile.ts`
- `migraineProfile.ts`

## Process

1. Copy `profileTemplate.ts`
2. Rename the file
3. Rename the exported constant
4. Fill in:
   - `profileId`
   - `therapeuticArea`
   - `diseaseNames`
   - `symptomPatterns`
   - `treatmentPatterns`
   - `burdenTerms`
   - `patientIndicators`
   - `caregiverIndicators`
   - exclusion patterns
5. Register the profile in `src/ingestion/profiles/index.ts`

## Best practices

### Symptom patterns
- Use normalized labels as keys
- Include both clinical and colloquial wording
- Avoid overlapping labels unless truly necessary

### Treatment patterns
- Include brand + generic names when relevant
- Include procedure names for interventional treatment areas

### Burden terms
- Focus on lived experience and disruption
- Include work, sleep, social, emotional, and physical burden signals

### Exclusions
Use exclusions to remove:
- awareness campaigns
- marketing / promo content
- low-signal chatter
- disease-specific misinformation if needed

### Disease context
Set `requireDiseaseContextForSymptoms = true` when symptom language is too broad and
would otherwise pull in many false positives.

## Goal
Profiles should make ingestion:
- repeatable
- explainable
- disease-specific
- scalable across therapeutic areas