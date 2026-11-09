/*
 * AskSocial PV Academy — interactive exercise content, modules 5–8.
 * Invented training content. The fictional client rules below exist only for practice;
 * live work uses the executed agreement and the client’s current procedure.
 */
(function () {
  var X = window.pvExercises = window.pvExercises || {};
  var B = window.pvxBuild, C = B.C, M = B.M, T = B.T, O = B.O, R = B.R, I = B.I;

  // ------------------------------------------------------------------ Module 5
  var SER = ['Urgent escalation — a possible seriousness criterion is described', 'Route as a potential case — no seriousness criterion described', 'Route and flag for PV — seriousness is unclear; other criteria may apply', 'No qualifying safety information identified'];
  function tri(label, text, ans, why, words) {
    var parts = [C('How do you triage it?', SER, ans, why)];
    if (words) parts.push(T('Tag the exact words that support your triage decision.', text.replace(/^“|”$/g, ''), ['words'], { words: words }, 'Record these words verbatim in the packet. They show why you escalated, without adding a diagnosis.'));
    return I(label, [text], parts);
  }
  X[5] = {
    title: 'Sort seriousness and urgency',
    intro: 'Intensity is not regulatory seriousness. Triage each fictional mention, and for some, tag the exact supporting words. Potential urgency is escalated without waiting for a confirmed diagnosis or a complete case.',
    items: [
      tri('Painful headache', '“Painful headache after my Drug A dose, gone by lunch.”', 1, 'A painful, short-lived headache describes intensity. No seriousness criterion is stated, so route it as a potential case without urgency.'),
      tri('Hospital admission', '“Admitted to hospital overnight after reacting to Drug A.”', 0, 'Reported hospital admission is a possible seriousness criterion. Escalate on the urgent route and preserve the words.', ['Admitted to hospital overnight']),
      tri('Emergency visit only', '“Ended up in A&E after Drug A, they sent me home after a few hours.”', 2, 'An emergency visit without admission does not automatically establish hospitalization, but other criteria (for example medically important events) may apply. Flag it for PV assessment.', ['Ended up in A&E', 'sent me home after a few hours']),
      tri('Breathing difficulty', '“Couldn’t breathe properly after my Drug A dose, throat felt tight.”', 0, 'Breathing difficulty with throat tightness may be life-threatening. Escalate urgently; you do not need a confirmed diagnosis.', ['Couldn’t breathe properly', 'throat felt tight']),
      tri('Unspecified reaction', '“Had a bad reaction to Drug A.”', 2, 'A “bad reaction” has no detail. Route it, flag the uncertainty and leave seriousness to PV with authorized follow-up. Do not assume either way.'),
      tri('Death', '“My brother died a week after starting Drug A.”', 0, 'A reported death is a seriousness criterion whatever the presumed cause. Escalate urgently and record only what is stated.', ['died a week after starting Drug A']),
      tri('Fatigue', '“Drug A made me so tired I slept all weekend.”', 1, 'Marked tiredness is intense but no seriousness criterion is described. Route it as a potential case.'),
      tri('Congenital anomaly', '“Baby born with a heart defect, I was on Drug A in early pregnancy.”', 0, 'A possible congenital anomaly after pregnancy exposure is a seriousness criterion. Escalate urgently and apply the pregnancy route as well.', ['born with a heart defect', 'on Drug A in early pregnancy']),
      tri('Disability', '“Since Drug A I can’t walk without a cane — been 3 months.”', 0, 'A lasting loss of function may indicate significant disability. Escalate and preserve the duration stated.'),
      tri('Prolonged stay', '“Hospital stay got extended 4 days because of a reaction to Drug A.”', 0, 'Prolonged hospitalization is a seriousness criterion. The author’s causal claim is recorded as their statement, not as a conclusion.'),
      tri('Hypothetical', '“Can Drug A put you in hospital? Asking before I start.”', 3, 'No exposure or event is described. Close it with a rationale, or route it as a medical-information enquiry if that is in scope.'),
      I('Fainting', ['“Felt faint and passed out briefly after Drug A, fine now.”'], C('How do you triage it?', SER, [0, 2], 'Loss of consciousness may be medically important. Urgent escalation, or routing with an explicit seriousness flag for PV, are both accepted. “Fine now” does not close it.'))
    ]
  };

  // ------------------------------------------------------------------ Module 6
  var ROUTE = ['Safety route', 'Quality route', 'Both safety and quality routes', 'Special-situation route (applies even without reported harm)', 'Another agreed route (for example a medical-information enquiry)', 'No route — no qualifying information'];
  function rt(label, text, ans, why) { return I(label, [text], C('Which route does the client handling matrix point to?', ROUTE, ans, why)); }
  X[6] = {
    title: 'Routing matrix: 20 special situations and complaints',
    intro: 'Classify each fictional example by route. Avoid both errors: declaring every special situation a reportable ADR, and treating every no-harm mention as irrelevant.',
    reference: { title: 'Fictional client handling matrix (training only)', lines: [
      'Special situations (pregnancy and breastfeeding, pediatric exposure, overdose, misuse, abuse, medication error, occupational exposure, lack of effect, off-label use) follow the special-situation route, with or without harm. If an adverse event also occurs, the safety route applies too.',
      'Product-quality defects go to the quality route. If a quality defect comes with harm or a possible missed dose, use both routes.',
      'Questions about using the product go to the medical-information route. Opinions with no exposure, event or defect need no route.'
    ] },
    items: [
      rt('Injector with injury', '“The Drug A injector jammed and the needle snapped off in my thigh.”', 2, 'A device defect with an injury needs both the quality and safety routes. Check whether a combination-product procedure also applies.'),
      rt('Pregnancy, no harm', '“Just found out I’m pregnant, been on Drug A for 2 months.”', 3, 'Pregnancy exposure follows the special-situation route even with no harm reported. Do not invent an outcome.'),
      rt('Breastfeeding', '“Breastfeeding while on Drug A, baby is fine.”', 3, 'Breastfeeding exposure is a special situation regardless of a good outcome.'),
      rt('Pediatric exposure', '“My toddler chewed through a Drug A blister pack, seems ok.”', 3, 'Accidental pediatric exposure is a special situation. “Seems ok” is not a reason to close it.'),
      rt('Double dose', '“Took double my Drug A dose by mistake this morning.”', 3, 'An overdose through medication error is a special situation even without symptoms.'),
      rt('Abuse report', '“People crush Drug A to get high, saw it on a forum.”', 3, 'Abuse is a special situation. With no specific patient it may also be incomplete, but it still follows the agreed route rather than being dismissed.'),
      I('Lack of effect', ['“Drug A stopped working for my epilepsy, seizures are back.”'], C('Which route does the client handling matrix point to?', ROUTE, [0, 3], 'Lack of effect with returning seizures is a special situation and may be serious. The safety route or the special-situation route is accepted. Escalate the seizures urgently under the procedure.')),
      rt('Different colour', '“Pills in my new Drug A box are a different colour from last month.”', 1, 'A possible product-quality issue with no harm described goes to the quality route.'),
      rt('Broken seal', '“Box of Drug A arrived with a broken seal.”', 1, 'A packaging integrity issue goes to the quality route.'),
      I('Occupational exposure', ['“Nurse here — splashed Drug A solution in my eye while preparing it, eye stung for an hour.”'], C('Which route does the client handling matrix point to?', ROUTE, [0, 3], 'Occupational exposure is a special situation, and the eye stinging is an event. The safety route or the special-situation route is accepted, and the matrix may require both.')),
      rt('Off-label use', '“My doctor prescribed Drug A for my acne, even though it’s not an acne drug.”', 3, 'Off-label use follows the special-situation route under this matrix. It is not automatically an ADR.'),
      rt('Interaction question', '“Does Drug A interact with grapefruit?”', 4, 'A usage question with no exposure or event goes to the medical-information route if that is in scope.'),
      rt('Price complaint', '“Drug A pens are too expensive.”', 5, 'A price opinion involves no exposure, event or defect.'),
      rt('Defect with harm', '“Drug A tablet had a black speck in it, I swallowed it and now my stomach hurts.”', 2, 'A possible quality defect plus a reported event needs both routes.'),
      rt('Labelling error', '“Pharmacy labelled my Drug A with someone else’s name, haven’t taken it.”', 3, 'A dispensing error is a medication error and a special situation, even though the product was not taken.'),
      rt('Expired product', '“Using Drug A past its expiry date because I can’t get a refill.”', 3, 'Using expired product counts as a medication error, a special situation, under this matrix.'),
      rt('Simple event', '“Drug A gave me a rash.”', 0, 'An adverse event with no special situation or quality issue goes to the safety route.'),
      I('Missed dose', ['“Injector clicked but no medicine came out, so I missed my dose.”'], C('Which route does the client handling matrix point to?', ROUTE, [1, 2], 'A device failure that causes a missed dose is a quality complaint with a possible safety element. The quality route or both routes are accepted; the matrix rule for missed doses decides.')),
      rt('Packaging praise', '“Love that the new Drug A packaging is recyclable!”', 5, 'Positive packaging feedback with no defect or exposure issue needs no route.'),
      rt('Misuse', '“Took Drug A with my partner’s prescription painkillers to sleep better.”', 3, 'Using a medicine outside its intended use, together with someone else’s prescription, is misuse, a special situation.')
    ]
  };

  // ------------------------------------------------------------------ Module 7
  X[7] = {
    title: 'Five notification packets',
    intro: 'Build the key parts of five packets from fictional threads. Preserve what the source said and keep unknowns explicit. Never infer age, country, diagnosis or causality from a profile, image or stereotype.',
    items: [
      I('Packet 1 · Baseline', ['Post by @sunnyday22, Tue 10:14 (UTC): “Week two on Drug A. Woke up with my lips swollen and itchy.”', 'Reply by @sunnyday22, Tue 10:40: “Took an antihistamine, going down now.” Profile: photo of a grey-haired woman; bio “Proud nana from Leeds”.'], [
        M('Which statements belong in the factual narrative?', ['Author reports taking Drug A for about two weeks.', 'Author reports waking with swollen, itchy lips.', 'In a reply 26 minutes later, the author reports taking an antihistamine and the swelling going down.', 'Patient is an elderly woman from Leeds.', 'Author had angioedema caused by Drug A.', 'Age, sex and country: not stated in the source.'], [0, 1, 2, 5], 'Profile photos and bios are not source facts about the patient. Do not diagnose (“angioedema”) or conclude causality.'),
        C('Which source details must the packet include?', ['The post text, the reply for context, the source link or ID, and both timestamps with time zone', 'A paraphrase of the post only', 'A screenshot of the profile photo so PV can estimate age'], 0, 'Traceability needs the verbatim text, relevant thread context, identifiers and timestamps.'),
        R('Write the factual narrative for this packet (2–4 sentences).', 'On Tue 10:14 UTC, @sunnyday22 posted that they were in week two of taking Drug A and woke up with swollen, itchy lips. In a reply at 10:40 UTC the same author reported taking an antihistamine and said the swelling was going down. The source does not state age, sex, country, dose or indication. Source link and IDs attached.',
          ['Uses the author’s words for the event (swollen, itchy lips)', 'Includes both timestamps with the time zone', 'Says the age, sex and country are not stated, rather than guessing them', 'Contains no diagnosis or causal conclusion'])
      ]),
      I('Packet 2 · Edited post', ['Original post, Wed 08:02: “Drug A made my vision blurry for a few hours.”', 'Edited Wed 09:30 to: “Drug A made my vision blurry for a few hours. Update: it’s fine now, probably just tiredness lol”'], [
        C('How do you handle the edit?', ['Record both versions with their timestamps; the edit adds follow-up information and the author’s own interpretation', 'Use only the latest version', 'Close the case because the author now blames tiredness'], 0, 'An edit is new information. Preserve the original and the edit. The author’s suggestion of tiredness is their opinion, not a reason to close.'),
        M('Which statements belong in the narrative?', ['Author reports blurry vision for a few hours after Drug A (original post, 08:02).', 'At 09:30 the author edited the post to say it had resolved, suggesting tiredness as the cause.', 'The blurry vision was caused by tiredness, not Drug A.', 'Author has a visual disorder.'], [0, 1], 'Report the author’s interpretation as theirs. Do not adopt it as a conclusion or add a diagnosis.')
      ]),
      I('Packet 3 · Deleted source', ['Captured in the dataset Thu 21:15: “3rd seizure this month since my dose of Drug A was doubled.”', 'When you open the link at Fri 08:00, the post has been deleted.'], [
        C('What do you do?', ['Transfer using the captured text and dataset record, note that the source was deleted when checked at Fri 08:00, and preserve the clock', 'Discard it because the source no longer exists', 'Wait to see whether the author reposts'], 0, 'A deleted source does not cancel captured safety information. Document the deletion and what you still hold.'),
        C('How urgent is it?', ['Escalate on the urgent route: repeated seizures after a dose increase may be serious', 'Routine, because the source is gone', 'Not urgent, because seizures are probably the indication'], 0, 'Recurrent seizures may be medically important. Do not assume they are the indication, and do not wait for certainty before escalating.')
      ]),
      I('Packet 4 · Non-English', ['Post (Spanish): “Desde que tomo Drug A tengo mareos y me desmayé una vez.”', 'Machine translation: “Since I take Drug A I have dizziness and I fainted once.”'], [
        C('What must the packet contain?', ['The original Spanish text, an approved translation, who or what produced it, and any differences in meaning', 'Only the English machine translation', 'Only the original text; translation is the client’s job'], 0, 'Keep the original and an approved translation side by side so meaning can be checked.'),
        M('Which points of meaning must the translation preserve?', ['Dizziness', 'Fainted once', 'Ongoing since starting Drug A (“desde que tomo”)', 'Fainted repeatedly'], [0, 1, 2], '“Una vez” means once. Translation must not intensify or soften the source.')
      ]),
      I('Packet 5 · Privacy and channel', ['Post: “Drug A gave me chest pain last night.” Reply from the same author: “DM me, my number is 07700 900123.”'], [
        C('How do you store and transfer it?', ['Use the client-approved transfer system and apply the privacy rules to unnecessary personal data', 'Email a screenshot from your personal account to client PV to save time', 'Paste it into a public AI chatbot to summarize'], 0, 'Safety information goes only through approved storage and transfer systems, with the privacy rules applied.'),
        M('Which statements belong in the narrative?', ['Author reports chest pain the previous night after Drug A.', 'Author is a 50-year-old man (from the profile photo).', 'The author posted contact details in a reply; handled under the client privacy rules.', 'Author has heart disease.'], [0, 2], 'Do not infer demographics or diagnoses. Handle contact details under the privacy rules rather than copying them freely.')
      ])
    ]
  };

  // ------------------------------------------------------------------ Module 8
  X[8] = {
    title: 'Clock scenarios and handoff log',
    intro: 'Apply the fictional client time rules below to each scenario. Record posting, collection, identification, review, dispatch and receipt separately. A regulator’s submission window is never permission for AskSocial to wait.',
    reference: { title: 'Fictional client rule CR-8 (training only)', lines: [
      'Routine potential cases: transfer by 17:00 Europe/London on the next business day after day zero. Business days are Monday to Friday, excluding listed public holidays.',
      'Urgent cases: transfer within 4 elapsed hours of identification, at any time of day.',
      'Day zero: client-owned channel = posting time, when sufficient information is visible. Planned listening (ODCS) = when the reviewer identifies the safety information. QA never resets day zero.',
      'If the transfer system fails, use the documented backup route. If no acknowledgement arrives within 2 hours, use the failed-delivery escalation.'
    ] },
    items: [
      I('Friday evening', ['A routine potential case posted on the client’s own page on Fri 19:40, with sufficient information visible.'], C('What is the transfer deadline?', ['Sat 17:00', 'Mon 09:00', 'Mon 17:00', 'Tue 17:00'], 2, 'Day zero is Friday (posting). The next business day is Monday, so the deadline is Mon 17:00. The weekend does not pause day zero.')),
      I('ODCS identification', ['The same text in the planned listening dataset: collected Sat 06:15, identified by the reviewer Mon 09:05.'], C('What is the transfer deadline?', ['Sat 17:00', 'Mon 17:00', 'Tue 17:00', 'Wed 17:00'], 2, 'Under the ODCS rule, day zero is identification (Monday), so the deadline is Tue 17:00. Collection is not a universal start time.')),
      I('Urgent at the weekend', ['The on-call responder identifies a possible serious case at Sat 22:10.'], C('What is the transfer deadline?', ['Sat 23:59', 'Sun 02:10', 'Mon 09:00', 'Mon 17:00'], 1, 'Urgent cases run on 4 elapsed hours from identification, whatever the day.')),
      I('Daylight saving', ['UK clocks go forward at 01:00 GMT on Sunday 29 March (to 02:00 BST). An urgent case is identified at Sun 00:30 GMT.'], C('What is the deadline in local time?', ['04:30 BST', '05:30 BST', '03:30 BST'], 1, '00:30 GMT is 00:30 UTC. Four elapsed hours is 04:30 UTC, which is 05:30 BST because the local hour from 01:00 to 02:00 is skipped. Calculate in UTC, then convert.')),
      I('Delayed discovery', ['An ODCS item was collected Mon 10:00 but sat unassigned in the queue. A reviewer identifies the safety information at Wed 14:00.'], C('Which statement is correct?', ['Under the identification rule, day zero is Wed 14:00, and the queue delay is logged as a deviation for investigation', 'Day zero is Mon 10:00 because that is when it was collected', 'Day zero can be set to whenever QA finishes'], 0, 'The rule defines day zero, but an unassigned item is a process failure that must be logged and investigated, not hidden.')),
      I('Public holiday', ['Day zero for a routine case is Thursday. Friday is a listed public holiday.'], C('What is the transfer deadline?', ['Fri 17:00', 'Mon 17:00', 'Tue 17:00'], 1, 'The holiday is not a business day, so the next business day after Thursday is Monday.')),
      I('System outage', ['The transfer system goes down at Mon 15:00. A routine case is due by Mon 17:00.'], C('What do you do?', ['Use the documented backup route, record the outage and attempt times, and keep the original deadline', 'Wait for the system to return and note the delay', 'Move the deadline to when the system recovers'], 0, 'Outages do not move deadlines. Use the backup route and preserve the evidence.')),
      I('No acknowledgement', ['A packet was sent at Mon 13:10. By 15:10 no acknowledgement has arrived.'], C('What do you do?', ['Start the failed-delivery escalation, contact the backup recipient, confirm receipt and record the times', 'Resend blindly every 10 minutes until something arrives', 'Treat it as delivered because the system says “sent”'], 0, '“Sent” is not proof of receipt. Escalate through the agreed route and investigate before resending, to avoid duplicates.')),
      I('Handoff log', null, O('Order the handoff log entries chronologically.', ['Fri 19:40 — Posted on platform', 'Sat 06:15 — Collected into dataset', 'Mon 09:05 — Reviewer identifies safety information', 'Mon 11:30 — QA review completed', 'Mon 13:10 — Packet sent to client', 'Mon 13:22 — Client acknowledges receipt'], 'Each event keeps its own timestamp. None overwrites another.')),
      I('Log contents', null, M('What must the handoff log record?', ['Posting, collection, identification, QA, dispatch and receipt times', 'The day-zero rule used and its version', 'The time zone of every timestamp', 'The regulator’s submission window as AskSocial’s deadline', 'Timestamps adjusted so the transfer looks on time'], [0, 1, 2], 'Never adjust historical timestamps. The vendor deadline is the contractual one, not the regulator’s window.')),
      I('Regulatory window', ['The client has 15 calendar days to submit a non-serious case to an authority.'], C('Can AskSocial take 14 days to transfer it?', ['Yes, as long as the client still meets its own deadline', 'No — AskSocial follows the contractual vendor deadline, which is much shorter', 'Only if QA approves'], 1, 'The regulator’s window belongs to the client. AskSocial’s obligation is the agreed transfer deadline.'))
    ]
  };
})();
