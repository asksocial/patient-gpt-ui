# Academy sequential learning

Curriculum UI version 1.1 integrates the seven Operating Model and Sponsor
Assurance lessons into the existing module list and lesson template. Modules
1–19 use bounded Previous/Continue navigation; module 19 leads to the combined
practice knowledge check. Module 12 continues to 13 instead of wrapping to 1.
The old `assurance.html` URL redirects to `index.html#module-13`.

The proposed eight-week plan comprises 50 taught hours, eight independent
hours, four formal-assessment hours and at least twelve supervised hours:
74 hours minimum. Weeks five and six contain the added operating lessons;
assessment/supervision move to weeks seven and eight. Displayed teaching hours
remain estimates, not proof of course delivery or qualification.

The tracker has 39 practice milestones: 19 lesson review flags, eight mention
cases, seven operating scenarios, three clock checks, and two knowledge
checkpoints. The combined knowledge sequence has eight core and fourteen
assurance questions. Each checkpoint must independently reach 90%; a strong
assurance score cannot conceal a failed core checkpoint.

Storage schema 2 writes `pvAcademy.v2` and reads the original `pvAcademy.v1`
only as a migration source. An older open tab cannot overwrite the new tracker.
It migrates original core completion,
case, clock and quiz data and imports reviewed lessons, operating scenarios,
and quiz answers from `askSocial.assurancePractice.v0.1`. A previously submitted
core quiz stays a core checkpoint, rather than being treated as a completed
22-question quiz. A submitted assurance quiz retains its own checkpoint.
Migration runs once; later undo or retake actions are not overwritten by old
standalone progress. Both old storage keys are retained unchanged; no original key is
deleted. Historical assessment/authorization weeks map to the new schedule.

Run `node scripts/qa/test-academy-pathway.mjs` from the repository root for
sequence boundaries, counts, deep links, separate score thresholds, malformed
state and legacy progress migration checks. Browser verification additionally
covers the actual template, inline scenarios and knowledge progression.

All stored completion is browser-local practice. The site supplies no named
authorization, supervisor signatures, centralized qualification records,
executed sponsor agreements or operational-validation evidence.
