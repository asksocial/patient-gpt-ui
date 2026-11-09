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

## Interactive module exercises

Every module (1–19) now includes an in-page interactive exercise, so the learner can complete
each exercise named in the curriculum without a facilitator or an external repository. Content
follows the guide's item counts: for example 20 annotated mentions (module 2), 15 case-element
worksheets (module 4), a 20-example routing matrix (module 6), five notification packets
(module 7), 20 calibration mentions with an independent second reviewer (module 9) and 20
client-rulebook examples (module 10). Modules 13–19 turn each assessed worksheet into written
answers that the learner compares with a model answer and self-marks against a checklist.
In total there are 202 items with 254 scored parts.

Item types: single choice (with optional multiple accepted answers), select-all, word tagging,
ordering, and written answer with model answer and checklist. All content is invented; "Drug A",
"Velarin", "tirofazone" and "Northbay Therapeutics" are fictional.

Files: `public/academy/assets/exercises.js` (engine), `assets/exercises.css`, and
`exercises-data-core-a.js`, `-core-b.js`, `-core-c.js`, `exercises-data-assurance.js` (content).
The engine mounts into `#pv-exercise-host` in the module view and stores progress under its own
key, `pvAcademy.exercises.v1`, so the 39-milestone tracker, storage schema 2 and its migration are
unchanged. Exercise scores do not count toward the 39 milestones and, like all browser progress,
are practice only: not assessor acceptance, qualification or authorization.

Run `node scripts/qa/test-academy-exercises.mjs` to check content integrity: every answer index is
valid, every tag key is present in its text, item counts meet the guide, and every key scores as
correct.
