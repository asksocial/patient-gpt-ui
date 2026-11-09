/*
 * AskSocial PV Academy — interactive exercise content, modules 9–12.
 * Invented training content: handles, cases, the client "Northbay Therapeutics", the product
 * name "Velarin" and the ingredient "tirofazone" are fictional.
 */
(function () {
  var X = window.pvExercises = window.pvExercises || {};
  var B = window.pvxBuild, C = B.C, M = B.M, T = B.T, O = B.O, R = B.R, I = B.I;

  // ------------------------------------------------------------------ Module 9
  var LINK = ['Repeat of an already-captured report with no new information (same author or a repost) — keep visible and link it', 'Possible same patient with new or changed information — link it and transfer as follow-up for client review', 'New, separate potential case', 'No safety information'];
  function cal(label, text, ans, peer, why) { return I(label, [text], C('How do you classify it against the existing cases?', LINK, ans, why, { peer: peer })); }
  X[9] = {
    title: 'Duplicate calibration: 20 mentions with a second reviewer',
    intro: 'Classify each new fictional mention against the three cases already transferred. After you check each answer you will see Reviewer B’s independent call. Where you disagree, the explanation gives the adjudicated rationale. Possible duplicates stay visible; nothing is silently deleted or merged.',
    reference: { title: 'Cases already transferred to the client', lines: [
      'CASE-0410 · Mon · X: @runner_jo — “Drug A gave me a pounding headache for 2 days.”',
      'CASE-0411 · Tue · Parenting forum: MapleMum — “My daughter (14) got a rash on her arms a week after starting Drug A.”',
      'CASE-0412 · Wed · Instagram: @lee.cooks — “Dizzy every morning since Drug A.”'
    ] },
    items: [
      cal('Unchanged repost', 'Thu · X: @fitfam reposts @runner_jo’s post unchanged.', 0, 0, 'A repost with no new information is linked to CASE-0410 and kept visible for client review.'),
      cal('Author update', 'Thu · X: @runner_jo — “Update: headache’s gone but now my vision is blurry.”', 1, 1, 'Same author, new event (blurry vision) and an outcome (headache resolved): this is follow-up information for CASE-0410.'),
      cal('Screenshot', 'Thu · Reddit: u/pharmawatch posts a screenshot of @runner_jo’s post with the comment “yikes”.', 0, 2, 'Reviewer B treated it as a new case, but a screenshot of another author’s post adds no new patient information. Adjudicated as a linked repeat, preserving the attribution.'),
      cal('Different author, same event', 'Thu · Facebook: Sam P. — “Pounding headache on Drug A here too.”', 2, 2, '“Here too” means a different person. A similar event is not a duplicate.'),
      cal('Forum follow-up', 'Fri · Parenting forum: MapleMum — “Daughter’s rash spread to her face, GP gave her a cream.”', 1, 1, 'Same author and patient, with progression and treatment: follow-up for CASE-0411.'),
      cal('Continuing symptom', 'Fri · Instagram: @lee.cooks — “Day 10 and still dizzy every morning on Drug A.”', 1, 0, 'Reviewer B saw a repeat, but the duration (“day 10”, still ongoing) is new information. Adjudicated as follow-up for CASE-0412.'),
      cal('Similar handle, other platform', 'Fri · TikTok: @lee_cooks_official — “Dizzy every morning since Drug A 😵”', 1, 2, 'A near-identical handle and wording on another platform suggests the same person but does not prove it. Link it as a possible same patient, explain the proposed link, and let the client decide.'),
      I('Look-alike name', ['Fri · Parenting forum: Mapl3Mum — “My girl got a rash after Drug A too.”'], C('How do you classify it against the existing cases?', LINK, [1, 2], 'The similar username suggests a link, but “too” suggests a different child. Either classification is accepted if you record the uncertainty and the proposed link. Never merge the two silently.', { peer: 2 })),
      cal('Unrelated post', 'Sat · X: @runner_jo — “Anyone know a good running app?”', 3, 3, 'Same author, but no safety information.'),
      cal('Captioned repost', 'Sat · Instagram: @healthnews reposts @lee.cooks’s post with the caption “another one”.', 0, 0, 'A repost of CASE-0412 adds no new patient information. Link it and keep the attribution.'),
      cal('Cross-platform same patient', 'Sat · Facebook: “My 14yo daughter has a rash from Drug A, I posted about it on a forum earlier this week.”', 1, 1, 'Matching age, event and the reference to the forum post point to the same patient as CASE-0411. Link it with that rationale.'),
      cal('Rechallenge', 'Sun · X: @runner_jo — “Headache back after restarting Drug A.”', 1, 1, 'A recurrence after restarting is important follow-up information for CASE-0410.'),
      cal('Different child', 'Sun · Parenting forum: DadOfThree — “My son has a rash after Drug A.”', 2, 1, 'Reviewer B linked it to CASE-0411, but a different author and a son rather than a daughter make this a separate potential case. Shared symptoms are not evidence of the same patient.'),
      cal('Deleted and replaced', 'Sun · Instagram: @lee.cooks deletes the original post and writes “Deleted my earlier post — dizziness gone since I stopped Drug A.”', 1, 1, 'Stopping the drug and the outcome are new information. The deletion of the original post is recorded; the transferred case stands.'),
      cal('New author, same symptom', 'Mon · YouTube comment by TravelTom: “Dizzy on Drug A like everyone else lol.”', 2, 2, 'A different person describing their own experience is a new potential case.'),
      cal('Thread bump', 'Mon · Parenting forum: MapleMum quotes her original post word for word with “bump — anyone else?”', 0, 0, 'A self-quote that only bumps the thread adds nothing new. Link it.'),
      cal('Restatement', 'Mon · X: @runner_jo — “2 days of pounding headache on Drug A last week, never again.”', 0, 1, 'Reviewer B saw follow-up, but this restates the same event with no new facts. Adjudicated as a linked repeat. If in doubt, linking it as follow-up is safe, because both keep it visible.'),
      I('Near-identical handle', ['Mon · Threads: @runner.jo — “Pounding headache 2 days, Drug A.”'], C('How do you classify it against the existing cases?', LINK, [0, 1], 'The handle and wording closely match CASE-0410. Linking it as a repeat or as a possible same patient is accepted, with the rationale recorded.', { peer: 1 })),
      cal('Admin note', 'Tue · Parenting forum: moderator note “Thread merged with ‘Drug A experiences’.”', 3, 3, 'A moderation notice contains no safety information. Note the thread change in the source record if it affects the links.'),
      cal('Restarted, symptom back', 'Tue · Instagram: @lee.cooks — “Dizzy again — back on Drug A since Friday.”', 1, 1, 'Restarting with recurrence is follow-up for CASE-0412.'),
      I('Disagreement log', ['Item 3: Reviewer B classified the screenshot as a new case; you classified it as a repeat.'], R('Write the disagreement-log entry for item 3.', 'Item: Reddit screenshot of @runner_jo’s post (Thu). Reviewer A: linked repeat of CASE-0410. Reviewer B: new case. Basis: the screenshot reproduces another author’s post with attribution visible; the comment “yikes” adds no patient information. Proposed resolution: link to CASE-0410 as a repeat, preserving the screenshot reference. Status: referred to the adjudicator; the item stays visible until decided.',
        ['Records both reviewers’ calls', 'Gives a source-based rationale', 'Keeps the item visible and linked; nothing deleted', 'Names the adjudication step or owner'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 10
  var SCOPE = ['In scope — route as a potential case or special situation under the rulebook', 'No Velarin safety information (no event, or clearly another product)', 'Competitor product only — apply the competitor-mention rule', 'Outside authorized scope (market, language or product) — exception route; do not discard', 'Ambiguous attribution — flag for PV with your rationale'];
  function rb(label, text, ans, why) { return I(label, [text], C('Which rulebook action applies?', SCOPE, ans, why)); }
  X[10] = {
    title: 'Screen 20 examples against a client rulebook',
    intro: 'Use the fictional client rulebook to screen each example. Locate the rule that applies and notice how it changes your action. Your qualification is specific to this client, product, language and procedure version.',
    reference: { title: 'Fictional rulebook: Northbay Therapeutics · Velarin · v3.2 (training only)', lines: [
      'Product in scope: Velarin (active ingredient tirofazone), for rheumatoid arthritis. Accepted aliases: “Vel”, “the blue pen”, and obvious misspellings of Velarin.',
      'Territory: United Kingdom and Ireland. Language: English. Other Northbay products (for example Cordexa) are not in this authorization.',
      'Competitor products (for example Brontex): if only a competitor is involved, apply the competitor-mention rule (record it; no Northbay transfer). If Velarin is also involved, screen it as in scope.',
      'Special situations (pregnancy, pediatric exposure, medication error, lack of effect) follow the special-situation route. Out-of-scope safety information follows the exception route; it is never discarded.'
    ] },
    items: [
      rb('Brand name', 'UK user: “Velarin gave me mouth ulcers 😩”', 0, 'In-scope product, market and language, with an event.'),
      rb('Ingredient, no event', 'UK user: “tirofazone week 3, knees feel better already”', 1, 'The active ingredient counts as the product, but improvement is not an event.'),
      rb('Alias', 'Irish user: “The blue pen makes me so nauseous”', 0, '“The blue pen” is a listed alias, so this is in scope.'),
      rb('Competitor only', 'UK user: “Brontex gave me a rash”', 2, 'Only a competitor is involved, so the competitor-mention rule applies.'),
      rb('Switch from competitor', 'UK user: “Switched from Brontex to Velarin — the Brontex rash cleared but now I get headaches”', 0, 'Velarin is involved with an event (headaches), so screen it as in scope and record the switch history.'),
      rb('Unclear abbreviation', 'UK user: “Started V. last week and I’m itchy all over”', 4, '“V.” is not a listed alias and could be another product. Flag it with your rationale rather than guessing.'),
      rb('Outside territory', 'User writes: “Velarin made my hair fall out, and my insurance in Texas won’t cover anything else.”', 3, 'The post itself places the user in the US, outside the authorized territory. Use the exception route; do not discard it. (Never infer market from a profile picture.)'),
      rb('Outside language', 'Post in French: “Velarin me donne des nausées.”', 3, 'French is not an authorized language for this reviewer and scope. Use the exception route.'),
      rb('Caregiver', 'UK user: “My nan’s on Velarin and keeps falling over”', 0, 'An in-scope caregiver report with an event (falls).'),
      rb('Pregnancy', 'UK user: “Pregnant and my rheumatologist wants to keep me on Velarin”', 0, 'Pregnancy exposure follows the special-situation route under the rulebook.'),
      rb('Advert opinion', 'UK user: “Velarin ad on TV again 🙄”', 1, 'No exposure or event is described.'),
      rb('Product question', 'UK user: “Is Velarin the same as tirofazone?”', 1, 'A question with no experience. Route it as a medical-information enquiry if that is in scope.'),
      rb('Other Northbay product', 'UK user: “Northbay’s other drug, Cordexa, makes me tired”', 3, 'Cordexa is not in this authorization. Use the exception route so the client’s other team can act.'),
      rb('Look-alike phrase', 'UK user: “My blue insulin pen keeps leaking”', 1, 'The phrase resembles an alias, but the context says insulin, so this is clearly another product.'),
      rb('Combination', 'UK user: “Brontex and Velarin together = constant headaches”', 0, 'Velarin is involved, so screen it as in scope and record both products.'),
      rb('Misspelling', 'UK user: “Velrin making me sick”', 0, 'An obvious misspelling counts under the alias rule.'),
      rb('Lack of effect', 'UK user: “Velarin (the RA one) no effect after 3 months, joints worse”', 0, 'Lack of effect is a special situation under the rulebook.'),
      rb('Ireland', 'Irish user: “Velarin got me hives, Dublin pharmacy said it’s common”', 0, 'Ireland is in the authorized territory. “It’s common” is not a reason to skip a labeled event.'),
      rb('Price comparison', 'UK user: “Brontex is cheaper than Velarin”', 1, 'A price comparison with no event or exposure issue needs no Velarin action.'),
      rb('Unnamed RA drug', 'UK user: “Some RA drug gave me a rash, can’t remember which”', 4, 'The indication matches but the product is unknown. Flag it with your rationale and do not assign it to Velarin.'),
      I('Locate the rule', ['Item 5: “Switched from Brontex to Velarin — the Brontex rash cleared but now I get headaches”'], R('Name the rulebook clause you used for item 5 and explain how it changed your action.', 'The competitor clause says that when a competitor and Velarin are both involved, the mention is screened as in scope. Without that clause I might have applied the competitor-mention rule because Brontex is named first. Because Velarin is involved with a new event (headaches), I route it as a potential case under rulebook v3.2 and record the Brontex history and the resolved rash as context.',
        ['Names the competitor/Velarin clause', 'Explains how the action would differ without it', 'Cites the rulebook version', 'Keeps the competitor history as context rather than dropping it'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 11
  function ai(label, mention, suggestion, opts, ans, why) { return I(label, [mention, 'AI suggestion: ' + suggestion], C('What is wrong with the suggestion?', opts, ans, why)); }
  X[11] = {
    title: 'Challenge the AI suggestions',
    intro: 'Each fictional mention comes with an AI-generated suggestion. Find the error and correct it from the source. A model score is a workflow aid: it does not establish causality or decide reportability, and you remain accountable.',
    items: [
      ai('Missed negation', '“No nausea at all on Drug A, just a bit tired.”', 'Events: nausea; fatigue.', ['Negated nausea was extracted as an event (keep the tiredness)', 'Fatigue should be removed', 'Nothing; accept it'], 0, 'Remove the negated nausea and keep tiredness in the author’s words. Log the correction against the tool version.'),
      ai('Invented symptom', '“Drug A makes my hands shake.”', 'Events: tremor; anxiety.', ['Anxiety is invented; the source only describes shaking hands', 'Tremor should be written as “hands shake”, otherwise fine', 'Nothing; accept it'], 0, 'The model added an event the author never mentioned. Record only “hands shake” as stated.'),
      ai('Wrong product', '“Drug B gave me a rash, Drug A is fine.”', 'Suspect product: Drug A; event: rash.', ['The suspect product should be Drug B; Drug A is described as fine', 'The rash is not an event', 'Nothing; accept it'], 0, 'The model attached the event to the wrong product. Correct it from the source. Drug B may be out of scope, in which case the exception route applies.'),
      ai('Inferred identity', '“Drug A made me dizzy” — posted by @gran_ma_jo.', 'Patient: female, in her 70s, UK.', ['Demographics were inferred from the handle; the source states none', 'The country should be blank but the age is fine', 'Nothing; accept it'], 0, 'Never infer age, sex or country from a handle, photo or stereotype. Record them as not stated.'),
      ai('Omitted pregnancy', '“Found out I’m 8 weeks pregnant, been on Drug A, feeling sick every morning.”', 'Event: nausea. Special situations: none.', ['Pregnancy exposure is missing from special situations', 'Nausea should be removed because it is a normal pregnancy symptom', 'Nothing; accept it'], 0, 'Add the pregnancy exposure, which needs its own route. Do not decide that the sickness is “just pregnancy”; record it as stated.'),
      ai('Overconfident duplicate', '“My daughter got a rash on Drug A” — forum user Bea, Tue. Existing case: MapleMum, Mon, daughter with a rash.', 'Duplicate of CASE-0411 (98%). Suggest auto-close.', ['A similarity score cannot close a case; keep it visible, propose the link with a rationale and let the client review', 'It is a duplicate; close it', 'Nothing; accept it'], 0, 'Different authors and no matching details. Possible duplicates stay visible, and the model’s confidence is not evidence.'),
      ai('Marked negative', '“Drug A and I are done. ER last night, couldn’t feel my left arm.”', 'Safety score 0.08: not safety-relevant.', ['The score missed a potentially serious event; verify against the source and escalate urgently', 'The score is low, so close it', 'Wait for the model to be retrained'], 0, 'The source describes an emergency visit and loss of sensation after Drug A. Escalate urgently and route the disagreement to the designated reviewer with the tool version.'),
      ai('Causality claim', '“Got a headache the day after my Drug A dose.”', 'Drug A caused the headache (probable).', ['Causality assessment is not the screener’s or the model’s call; record the timing as stated', 'It should say “certain”', 'Nothing; accept it'], 0, 'Remove the causal conclusion. Record “headache the day after the dose” as the author’s observation.'),
      I('Corrected record', ['Item 7: “Drug A and I are done. ER last night, couldn’t feel my left arm.” AI score 0.08.'], R('Write the corrected record and disagreement note for item 7.', 'Corrected record: product Drug A; author reports an emergency visit last night and not being able to feel their left arm (verbatim); outcome and diagnosis not stated; urgent escalation under the client procedure. Disagreement note: the model scored the mention 0.08 (not safety-relevant), tool version recorded; I overrode it because the source describes an event after Drug A with a possible seriousness indicator. Routed to the designated reviewer for model-quality follow-up. Worked in the approved environment only.',
          ['Records the event verbatim, without a diagnosis', 'Escalates on the urgent route', 'Logs the tool version and the reason for the override', 'Routes the disagreement to the designated reviewer'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 12
  var DISP = ['Potential case for client PV assessment', 'Incomplete safety concern', 'Special situation or quality concern', 'No qualifying safety information identified'];
  var URG = ['Urgent: yes', 'Urgent: no'];
  function q(label, text, disp, urg, why) { return I(label, [text], [C('Disposition', DISP, disp, null), C('Urgent escalation route?', URG, urg, why)]); }
  X[12] = {
    title: 'Mock shift: process, transfer, reconcile, explain',
    intro: 'You are on a fictional Tuesday 09:00–17:00 shift. Give each queue item a disposition and urgency, handle the urgent interruption, reconcile the queue before handover, then explain one escalation and one non-escalation to a client reviewer.',
    items: [
      q('Queue 1 · 09:10', '“Drug A gave me a metallic taste lol”', 0, 1, 'An event after exposure with no seriousness criterion: a routine potential case.'),
      q('Queue 2 · 09:25', '“Is Drug A ok with ibuprofen?”', 3, 1, 'A question with no experience. Route it as a medical-information enquiry if that is in scope and record the rationale.'),
      q('Queue 3 · 09:40', '“Husband collapsed after his Drug A injection, ambulance on the way.”', 0, 0, 'A collapse needing an ambulance is potentially serious. Escalate immediately on the urgent route.'),
      q('Queue 4 · 10:05', '“Pharmacy gave me 10mg Drug A instead of 5mg, took 2 doses.”', 2, 1, 'A dispensing error with exposure to a higher dose is a special situation. No harm is described, so it is not urgent.'),
      I('Queue 5 · 10:30', ['“Reposting: ‘Drug A gave me a metallic taste lol’” (a repost of Queue 1)'], [C('Disposition', DISP, [0, 1], 'A repost of Queue 1: link it and keep it visible. Either disposition is accepted if the link and attribution are recorded.'), C('Urgent escalation route?', URG, 1, null)]),
      q('Queue 6 · 11:00', '“Drug A pens are recycled at my pharmacy now 👍”', 3, 1, 'No exposure, event or defect. Close it with a rationale.'),
      I('Urgent interruption', ['Queue 3 arrives while you are writing up Queue 2.'], O('Put your actions in order.', ['Pause the routine work and open Queue 3', 'Escalate Queue 3 on the urgent route with the exact source words', 'Confirm the client acknowledged the urgent transfer', 'Record the times and your handling in the shift log', 'Resume Queue 2 and the rest of the queue'], 'Urgent work interrupts routine work, but the routine item is resumed, not lost. Receipt confirmation is part of the urgent transfer.')),
      I('Reconciliation · 16:30', ['Queue 1: transferred, acknowledged. Queue 2: closed with rationale. Queue 3: urgent transfer, acknowledged 09:58. Queue 4: transferred 10:20, no acknowledgement. Queue 5: linked to Queue 1, no owner recorded. Queue 6: closed, no rationale recorded.'], M('Which items need action before handover?', ['Queue 1', 'Queue 2', 'Queue 3', 'Queue 4', 'Queue 5', 'Queue 6'], [3, 4, 5], 'Queue 4 lacks proof of receipt; Queue 5 lacks an accountable owner; Queue 6 lacks a recorded rationale. Every item needs a disposition, every transfer a confirmed recipient, and every open item an owner.')),
      I('Handover', ['At 17:00, Queue 4 is still unacknowledged.'], C('What do you do?', ['Hand over Queue 4 explicitly with its original deadline and the failed-delivery status; you keep ownership until the next owner accepts it', 'Leave a note in the chat and log off', 'Mark it complete because it was sent'], 0, 'Ownership cannot vanish between shifts. The outgoing owner keeps it until there is explicit acceptance or a documented escalation.')),
      I('Explain an escalation', ['Queue 3: “Husband collapsed after his Drug A injection, ambulance on the way.”'], R('Explain to a client reviewer why you escalated Queue 3 urgently.', 'At 09:40 the author reported that her husband (the patient) collapsed after his Drug A injection and that an ambulance was on the way. A collapse needing emergency services is a possible seriousness indicator, so under the client procedure I used the urgent route without waiting for a diagnosis or outcome. I transferred the verbatim text, source link and timestamps, confirmed receipt at 09:58, and logged the times. Causality and seriousness assessment remain with client PV.',
        ['Quotes or closely reflects the source words', 'Names the procedure rule that made it urgent', 'Gives the timestamps and receipt confirmation', 'Leaves causality and seriousness assessment to client PV'])),
      I('Explain a non-escalation', ['Queue 6: “Drug A pens are recycled at my pharmacy now 👍”'], R('Explain to a client reviewer why Queue 6 was not escalated.', 'The post says the pharmacy now recycles Drug A pens. It describes no exposure, adverse event, special situation or product defect, so under the client procedure there is no qualifying safety information. I read the surrounding thread for any other safety content, found none, and recorded the rationale and the procedure version when closing it.',
        ['Says what the source actually states', 'Names each category checked (event, special situation, quality)', 'Mentions checking the thread context', 'Records a rationale and the procedure version'])
      )
    ]
  };
})();
