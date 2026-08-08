import type {
  PvAdverseEventOntology,
  PvConceptMatch,
  PvContentInput,
  PvOntologyEvidence,
} from "./types";

export const PV_AE_ONTOLOGY_VERSION = "pv-ae-ontology-1.0.0";

function normalizedText(input: PvContentInput) {
  return [input.verbatim, input.parentContext || "", ...(input.threadContext || [])]
    .join(" ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueEvidence(items: PvOntologyEvidence[]) {
  return items.filter((item, index) =>
    items.findIndex((candidate) => candidate.value.toLowerCase() === item.value.toLowerCase()) === index
  );
}

function matchEvidence(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[0]?.trim();
}

function isNegated(text: string, evidence: string) {
  const index = text.toLowerCase().indexOf(evidence.toLowerCase());
  if (index < 0) return false;
  const prefix = text.slice(Math.max(0, index - 28), index).toLowerCase();
  return /\b(?:no|not|never|without|wasn't|was not|didn't|did not|haven't|have not)\b[^.!?]{0,24}$/.test(prefix);
}

function extractOutcome(text: string): PvAdverseEventOntology["outcomes"] {
  const rules: Array<[PvAdverseEventOntology["outcomes"][number]["category"], RegExp, number]> = [
    ["fatal", /\b(?:died|death|fatal|passed away)\b/i, 0.98],
    ["permanent_injury", /\b(?:permanent(?:ly)?|permanent injury|permanent damage|disabled|disability)\b/i, 0.92],
    ["hospitalization", /\b(?:hospitali[sz](?:ed|ation)|admitted to (?:the )?hospital|emergency room|\bER\b)\b/i, 0.96],
    ["recovered", /\b(?:recovered|resolved|went away|back to normal|fine now|fully healed)\b/i, 0.9],
    ["ongoing", /\b(?:ongoing|still (?:have|having|experiencing|hurts|sick)|hasn't gone away|have not recovered|not resolved)\b/i, 0.88],
  ];
  return rules.flatMap(([category, pattern, confidence]) => {
    const evidence = matchEvidence(text, pattern);
    return evidence && !isNegated(text, evidence) ? [{ category, value: category, evidence, confidence }] : [];
  });
}

function extractTimeToOnset(text: string): PvAdverseEventOntology["timeToOnset"] {
  const rules: Array<[PvAdverseEventOntology["timeToOnset"]["category"], RegExp, number]> = [
    ["immediate", /\b(?:immediately|right away|straight away|within (?:a few )?minutes?|minutes? later)\b/i, 0.94],
    ["hours", /\b(?:within )?(?:an?|one|two|three|four|five|six|\d+)\s*hours?\b|\bhours? later\b/i, 0.92],
    ["days", /\b(?:within )?(?:a|one|two|three|four|five|six|seven|\d+)\s*days?\b|\bdays? later\b|\bthe next day\b/i, 0.92],
    ["weeks", /\b(?:within )?(?:a|one|two|three|four|five|six|\d+)\s*weeks?\b|\bweeks? later\b/i, 0.92],
    ["months", /\b(?:within )?(?:a|one|two|three|four|five|six|\d+)\s*months?\b|\bmonths? later\b/i, 0.92],
  ];
  for (const [category, pattern, confidence] of rules) {
    const evidence = matchEvidence(text, pattern);
    if (evidence) return { category, value: evidence, evidence, confidence };
  }
  return { category: "unknown", confidence: 0 };
}

function extractSeverity(text: string, matches: PvConceptMatch[]): PvAdverseEventOntology["severity"] {
  const explicit: Array<["severe" | "moderate" | "mild", RegExp, number]> = [
    ["severe", /\b(?:severe|very severe|excruciating|unbearable)\b/i, 0.94],
    ["moderate", /\b(?:moderate|moderately)\b/i, 0.94],
    ["mild", /\b(?:mild|slight|minor)\b/i, 0.94],
  ];
  for (const [value, pattern, confidence] of explicit) {
    const evidence = matchEvidence(text, pattern);
    if (evidence && !isNegated(text, evidence)) return { value, evidence, confidence };
  }
  const severityConcept = matches.find((match) => match.category === "severity");
  if (severityConcept) {
    const value = /mild|minor|slight/i.test(severityConcept.canonicalTerm) ? "mild"
      : /moderate/i.test(severityConcept.canonicalTerm) ? "moderate"
        : /severe|critical|emergency|terrible/i.test(severityConcept.canonicalTerm) ? "severe" : "unclear";
    return { value, evidence: severityConcept.matchedTerm, confidence: value === "unclear" ? 0.35 : 0.72 };
  }
  return { value: "unclear", confidence: 0 };
}

function extractSeriousness(text: string): PvAdverseEventOntology["seriousness"] {
  const nonSerious = matchEvidence(text, /\b(?:non[- ]serious|not serious|did not require (?:medical care|hospitalization)|was not hospitalized|wasn't hospitalized)\b/i);
  const criteriaRules: Array<[string, RegExp]> = [
    ["death", /\b(?:died|death|fatal|passed away)\b/i],
    ["life_threatening", /\b(?:life[- ]threatening|nearly died|almost died)\b/i],
    ["hospitalization", /\b(?:hospitali[sz](?:ed|ation)|admitted to (?:the )?hospital|emergency room|\bER\b)\b/i],
    ["disability_or_permanent_injury", /\b(?:permanent injury|permanent damage|disabled|disability)\b/i],
    ["congenital_anomaly", /\b(?:birth defect|congenital anomal(?:y|ies))\b/i],
    ["medically_important", /\b(?:medically important|required urgent intervention|emergency surgery)\b/i],
  ];
  const supported = criteriaRules.flatMap(([criterion, pattern]) => {
    const evidence = matchEvidence(text, pattern);
    return evidence && !isNegated(text, evidence) ? [{ criterion, evidence }] : [];
  });
  if (supported.length) {
    return { value: "serious", criteria: supported.map((item) => item.criterion), evidence: supported.map((item) => item.evidence), confidence: 0.96 };
  }
  if (nonSerious) return { value: "non_serious", criteria: [], evidence: [nonSerious], confidence: 0.9 };
  return { value: "unclear", criteria: [], evidence: [], confidence: 0 };
}

function extractUnexpectedness(text: string, adverseEvents: PvOntologyEvidence[], expectedEvents: string[]): PvAdverseEventOntology["unexpectedness"] {
  const normalizedExpected = expectedEvents.map((item) => item.toLowerCase().trim()).filter(Boolean);
  const configured = adverseEvents.find((event) => normalizedExpected.includes(event.value.toLowerCase()));
  if (configured) return { value: "expected_label_event", evidence: configured.evidence, basis: "configured_label_reference", confidence: 0.96 };
  const expectedLanguage = matchEvidence(text, /\b(?:known|expected|listed|on the label) (?:adverse event|reaction|side effect|risk)\b/i);
  if (expectedLanguage) return { value: "expected_label_event", evidence: expectedLanguage, basis: "explicit_reporter_language", confidence: 0.65 };
  const emergingLanguage = matchEvidence(text, /\b(?:unexpected|not listed|unlisted|new side effect|never heard of this (?:reaction|side effect)|unreported)\b/i);
  if (emergingLanguage) return { value: "emerging_signal", evidence: emergingLanguage, basis: "explicit_reporter_language", confidence: 0.62 };
  return { value: "unclear", basis: "insufficient_reference", confidence: 0 };
}

function extractCausality(text: string): PvAdverseEventOntology["causality"] {
  const denied = matchEvidence(text, /\b(?:not due to|not caused by|unrelated to|don't think it was from|do not think it was from)\b/i);
  if (denied) return [{ value: "denied", phrase: denied, evidence: denied, confidence: 0.92 }];
  const rules: Array<[PvAdverseEventOntology["causality"][number]["value"], RegExp, number]> = [
    ["reported_attribution", /\b(?:caused by|because of|I blame|definitely from)\b/i, 0.82],
    ["possible_attribution", /\b(?:possibly due to|possibly from|might be from|may be from|think it was from|could be from|I suspect)\b/i, 0.75],
    ["temporal_association", /\b(?:after|following|since|shortly after)\b/i, 0.58],
  ];
  return rules.flatMap(([value, pattern, confidence]) => {
    const evidence = matchEvidence(text, pattern);
    return evidence ? [{ value, phrase: evidence, evidence, confidence }] : [];
  }).slice(0, 2);
}

export function extractPvAdverseEventOntology(
  input: PvContentInput,
  matches: PvConceptMatch[],
  options: { expectedEvents?: string[] } = {}
): PvAdverseEventOntology {
  const text = normalizedText(input);
  const productProcedures = uniqueEvidence(matches.filter((match) => match.category === "product").map((match) => ({
    value: match.canonicalTerm, evidence: match.matchedTerm, confidence: Math.min(1, match.weight / 100),
  })));
  const adverseEvents = uniqueEvidence(matches.filter((match) => match.category === "adverse_experience").map((match) => ({
    value: match.canonicalTerm, evidence: match.matchedTerm, confidence: Math.min(1, match.weight / 100),
  })));
  const seriousness = extractSeriousness(text);
  const outcomes = extractOutcome(text);
  const timeToOnset = extractTimeToOnset(text);
  const severity = extractSeverity(text, matches);
  const unexpectedness = extractUnexpectedness(text, adverseEvents, options.expectedEvents || []);
  const causality = extractCausality(text);
  const limitations = [
    seriousness.value === "unclear" ? "Seriousness cannot be inferred from the absence of a seriousness criterion." : "",
    unexpectedness.value === "unclear" ? "Expectedness requires a configured, versioned reference label or explicit reporter language." : "",
    !causality.length ? "No explicit temporal or attribution language was detected; causality is not established." : "Causality fields represent reporter language only and are not a clinical causality assessment.",
  ].filter(Boolean);
  return {
    productProcedures, adverseEvents, seriousness, outcomes, timeToOnset, severity, unexpectedness, causality,
    limitations, ontologyVersion: PV_AE_ONTOLOGY_VERSION,
  };
}
