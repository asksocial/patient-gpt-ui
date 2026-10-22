import { classifyPvContent } from "../detection";
import { samePvLanguage } from "../language";
import type { PvContentInput, PvDetectionConcept } from "../types";
import { glp1RegulatoryConfiguration, GLP1_PV_VERSION } from "./config";

function concept(id: string, category: PvDetectionConcept["category"], canonicalTerm: string, terms: string[], weight = 100): PvDetectionConcept {
  return { id: `glp1-${id}`, category, canonicalTerm, terms, weight, version: 1, active: true, language: "en" };
}

export const GLP1_PV_CONCEPTS: PvDetectionConcept[] = [
  ...glp1RegulatoryConfiguration.productRegistry.families.map((family) => concept(family.familyId, "product", family.activeIngredients[0], [...family.brands, ...family.activeIngredients])),
  concept("class", "product", "GLP-1 (product unspecified)", ["glp-1", "glp1", "glp 1", "glp-1 receptor agonist"]),
  concept("nausea", "adverse_experience", "Nausea", ["nausea", "nauseous", "nauseated", "feel sick", "feeling sick"]),
  concept("vomiting", "adverse_experience", "Vomiting", ["vomiting", "vomited", "throwing up", "threw up", "can't keep food down", "cannot keep food down"]),
  concept("constipation", "adverse_experience", "Constipation", ["constipation", "constipated", "can't poop", "cannot poop"]),
  concept("diarrhoea", "adverse_experience", "Diarrhoea", ["diarrhea", "diarrhoea", "loose stools"]),
  concept("pain", "adverse_experience", "Abdominal pain", ["abdominal pain", "stomach pain", "stomach cramps", "stomach ache"]),
  concept("gastric-emptying", "adverse_experience", "Impaired gastric emptying", ["gastroparesis", "stomach paralysis", "delayed gastric emptying"]),
  concept("obstruction", "adverse_experience", "Intestinal obstruction", ["ileus", "bowel obstruction", "intestinal obstruction", "blocked bowel"]),
  concept("pancreatitis", "adverse_experience", "Pancreatitis", ["pancreatitis", "inflamed pancreas"]),
  concept("gallbladder", "adverse_experience", "Gallbladder disorder", ["gallstones", "cholelithiasis", "cholecystitis", "gallbladder pain", "gallbladder attack"]),
  concept("hypoglycaemia", "adverse_experience", "Hypoglycaemia", ["hypoglycemia", "hypoglycaemia", "low blood sugar"]),
  concept("hyperglycaemia", "adverse_experience", "Blood glucose increased", ["blood glucose increased", "blood sugar increased", "high blood sugar", "hyperglycemia", "hyperglycaemia"]),
  concept("dyspepsia", "adverse_experience", "Dyspepsia", ["dyspepsia", "indigestion"]),
  concept("reflux", "adverse_experience", "Gastrooesophageal reflux disease", ["gastrooesophageal reflux", "gastroesophageal reflux", "acid reflux", "heartburn"]),
  concept("depression", "adverse_experience", "Depression", ["depression", "depressed", "depressive symptoms"]),
  concept("anxiety", "adverse_experience", "Anxiety", ["anxiety", "panic attack", "panic attacks"]),
  concept("suicidal-ideation", "adverse_experience", "Suicidal ideation", ["suicidal ideation", "suicidal thoughts", "thoughts of suicide"]),
  concept("dehydration", "adverse_experience", "Dehydration", ["dehydration", "dehydrated"]),
  concept("kidney", "adverse_experience", "Renal injury", ["acute kidney injury", "kidney failure", "renal failure"]),
  concept("vision", "adverse_experience", "Visual disturbance", ["blurred vision", "blurry vision", "vision loss", "lost vision", "blindness"]),
  concept("allergy", "adverse_experience", "Hypersensitivity", ["allergic reaction", "anaphylaxis", "hives", "throat swelling"]),
  concept("fatigue", "adverse_experience", "Fatigue", ["fatigue", "exhausted", "extreme tiredness"]),
  concept("headache", "adverse_experience", "Headache", ["headache", "headaches"]),
  concept("dizziness", "adverse_experience", "Dizziness", ["dizziness", "dizzy", "fainted", "syncope"]),
  concept("injection", "adverse_experience", "Injection site reaction", ["injection site reaction", "injection site pain", "injection site swelling", "injection site bleeding", "injection site haemorrhage"]),
  concept("hair", "adverse_experience", "Alopecia", ["hair loss", "hair falling out", "alopecia"]),
  concept("pregnancy", "pregnancy", "Pregnancy or breastfeeding exposure", ["pregnant", "pregnancy", "breastfeeding", "breast feeding"]),
  concept("dose-error", "medication_error", "Medication error", ["wrong dose", "wrong dosage", "dosing error", "medication error", "accidentally injected", "double dose", "wrong units", "wrong pen", "incorrect dose administered", "missed my dose", "dose omission", "wrong injection technique"]),
  concept("overdose", "overdose", "Overdose", ["overdose", "overdosed", "overdosing", "took too much", "injected too much"]),
  concept("ineffective", "lack_of_efficacy", "Drug ineffective", ["not working", "stopped working", "didn't work", "did not work", "no effect", "drug ineffective"]),
  concept("misuse", "misuse_abuse", "Misuse or abuse", ["sharing my pen", "shared a pen", "without a prescription", "misuse", "abuse"]),
  concept("quality", "product_quality", "Product quality complaint", ["counterfeit", "fake ozempic", "fake mounjaro", "contaminated", "broken pen", "faulty pen", "product quality", "device malfunction", "device defective", "device leakage", "pen leaking", "recalled product"]),
  concept("severity", "severity", "Serious outcome context", ["hospitalized", "hospitalised", "hospitalization", "emergency room", "life threatening", "died"]),
  concept("treatment-change", "treatment_change", "Treatment change", ["stopped taking", "discontinued", "reduced my dose", "dose reduced"]),
];

function escaped(term: string) { return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Retain a term if any occurrence is asserted. A negated earlier occurrence must
// not erase a later report of the same event. Boundaries avoid e.g. "dizzying".
function asserted(text: string, term: string) {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped(term)}(?![\\p{L}\\p{N}])`, "giu");
  for (const match of text.matchAll(pattern)) {
    const prefix = text.slice(Math.max(0, match.index! - 85), match.index).split(/\b(?:but|however|yet)\b/i).pop()!.replace(/\bnot (?:only|to mention)\b/gi, "");
    if (!/\b(?:no|not|never|without|denies|denied|won't|will not|wouldn't|would not|don't have|do not have|didn't have|did not have|worried about|risk of|can cause|may cause|could cause)\b[^.!?;]{0,55}$/i.test(prefix)) return true;
  }
  return false;
}

export function classifyGlp1PvContent(input: PvContentInput, concepts = GLP1_PV_CONCEPTS, options: { threshold?: number; libraryVersion?: number; expectedEvents?: string[] } = {}) {
  if (!input.language || !samePvLanguage(input.language, "en")) throw new Error("GLP-1 screening requires explicit English source metadata; other or unknown languages require a qualified language workflow.");
  const text = [input.verbatim, input.parentContext || "", ...(input.threadContext || [])].join(" ").replace(/[\u2018\u2019]/g, "'");
  const exposure = /\b(?:i|i've|i have|i'm|i am|my|our|patient|she|he|they)\b[^.!?]{0,140}\b(?:took|taking|take|started|starting|used|using|injected|received|on|prescribed|after)\b|\b(?:after|since|following)\s+(?:my\s+|i\s+)?(?:first\s+|starting\s+|taking\s+|using\s+|injecting\s+)?(?:dose|shot|injection|ozempic|wegovy|mounjaro|zepbound|semaglutide|tirzepatide)\b|\b(?:ozempic|wegovy|mounjaro|zepbound|semaglutide|tirzepatide)\s+(?:made|makes|gave|gives)\s+me\b/i.test(text);
  const promotional = /\b(?:buy now|promo code|discount code|dm to order|shop now)\b/i.test(text);
  const filtered = concepts.map((item) => ({ ...item, terms: item.terms.filter((term) => item.category === "product" || asserted(text, term)) }));
  const result = classifyPvContent(input, filtered, options);
  // No final reportability or expectedness is inferred from FAERS frequency.
  if (!exposure || promotional) {
    result.shouldCreateRecord = false;
    result.rationale.push(promotional ? "Promotional content is retained as screening evidence without creating a case." : "Product/event co-occurrence without treatment-exposure context does not create a social safety case.");
  }
  result.classifierVersion = GLP1_PV_VERSION;
  if (/\b(?:switch|switched|switching|went back)\b/i.test(text)) result.rationale.push("Multiple-treatment or switching context: verify which exposure, if any, is associated with each reported event. Product selection is provisional.");
  result.rationale.push("GLP-1 rules propose human review only. FAERS co-reports do not establish drug-event causality or label expectedness.");
  return result;
}
