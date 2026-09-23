export type BotulinumPvAcceptanceFixture = {
  id: string;
  rawMention: string;
  authorIdentifier: string | null;
  expectedProducts: string[];
  expectedMeddraCandidates: string[];
  expectedNegated: boolean;
  expectedHypothetical: boolean;
  expectedPvRelevant: boolean;
  expectedHumanReview: boolean;
  tags: string[];
};

const products = [
  { mention: "Botox", normalized: "BOTOX" },
  { mention: "Botox Cosmetic", normalized: "BOTOX COSMETIC" },
  { mention: "Dysport", normalized: "DYSPORT" },
  { mention: "Xeomin", normalized: "XEOMIN" },
  { mention: "Jeuveau", normalized: "JEUVEAU" },
  { mention: "Daxxify", normalized: "DAXXIFY" },
  { mention: "Letybo", normalized: "LETYBO" },
] as const;

const events = [
  { expression: "droopy eyelid", meddra: "Eyelid ptosis", tag: "eyelid_ptosis" },
  { expression: "trouble swallowing", meddra: "Dysphagia", tag: "dysphagia" },
  { expression: "can't breathe", meddra: "Dyspnoea", tag: "dyspnea" },
  { expression: "muscle weakness", meddra: "Muscular weakness", tag: "weakness" },
  { expression: "blurry vision", meddra: "Vision blurred", tag: "blurred_vision" },
  { expression: "seeing double", meddra: "Diplopia", tag: "diplopia" },
  { expression: "painful bump", meddra: "Injection site pain", tag: "injection_site_reaction" },
  { expression: "swollen injection site", meddra: "Injection site swelling", tag: "injection_site_reaction" },
  { expression: "redness where I was injected", meddra: "Injection site erythema", tag: "injection_site_reaction" },
  { expression: "crooked smile", meddra: "Facial asymmetry", tag: "facial_asymmetry" },
  { expression: "slurred speech", meddra: "Dysarthria", tag: "speech_difficulty" },
  { expression: "severe allergic reaction", meddra: "Anaphylactic reaction", tag: "allergic_reaction" },
  { expression: "generalized weakness", meddra: "Muscular weakness", tag: "generalized_weakness" },
] as const;

function standardFixtures(): BotulinumPvAcceptanceFixture[] {
  return products.flatMap((product, productIndex) => Array.from({ length: 7 }, (_, scenarioIndex) => {
    const event = events[(productIndex * 7 + scenarioIndex) % events.length];
    const sequence = productIndex * 7 + scenarioIndex + 1;
    const id = `btx-e2e-${String(sequence).padStart(3, "0")}`;
    const authorIdentifier = `@acceptance_${String(sequence).padStart(3, "0")}`;
    if (scenarioIndex === 0) return {
      id,
      rawMention: `I'm a ${32 + productIndex}-year-old woman. Two days after ${product.mention}, I developed ${event.expression}.`,
      authorIdentifier,
      expectedProducts: [product.normalized],
      expectedMeddraCandidates: [event.meddra],
      expectedNegated: false,
      expectedHypothetical: false,
      expectedPvRelevant: true,
      expectedHumanReview: true,
      tags: [product.normalized, event.tag, "observed_self", "patient_characteristic"],
    };
    if (scenarioIndex === 1) return {
      id,
      rawMention: `My wife developed ${event.expression} one day after her ${product.mention} injections, and I saw it happen.`,
      authorIdentifier,
      expectedProducts: [product.normalized],
      expectedMeddraCandidates: [event.meddra],
      expectedNegated: false,
      expectedHypothetical: false,
      expectedPvRelevant: true,
      expectedHumanReview: true,
      tags: [product.normalized, event.tag, "third_party", "first_hand_other"],
    };
    if (scenarioIndex === 2) return {
      id,
      rawMention: `Not sure if it's related, but I've had ${event.expression} since getting ${product.mention}.`,
      authorIdentifier,
      expectedProducts: [product.normalized],
      expectedMeddraCandidates: [event.meddra],
      expectedNegated: false,
      expectedHypothetical: false,
      expectedPvRelevant: true,
      expectedHumanReview: true,
      tags: [product.normalized, event.tag, "uncertain_causality", "observed_self"],
    };
    if (scenarioIndex === 3) return {
      id,
      rawMention: `${product.mention}. 2 days later. ${event.expression} 😰 help`,
      authorIdentifier: null,
      expectedProducts: [product.normalized],
      expectedMeddraCandidates: [event.meddra],
      expectedNegated: false,
      expectedHypothetical: false,
      expectedPvRelevant: true,
      expectedHumanReview: true,
      tags: [product.normalized, event.tag, "fragmented_social_post", "missing_icsr_elements"],
    };
    if (scenarioIndex === 4) return {
      id,
      rawMention: `After ${product.mention}, I developed ${event.expression} and a headache.`,
      authorIdentifier,
      expectedProducts: [product.normalized],
      expectedMeddraCandidates: [event.meddra, "Headache"],
      expectedNegated: false,
      expectedHypothetical: false,
      expectedPvRelevant: true,
      expectedHumanReview: true,
      tags: [product.normalized, event.tag, "multiple_events", "observed_self"],
    };
    if (scenarioIndex === 5) return {
      id,
      rawMention: `Can ${product.mention} cause ${event.expression}?`,
      authorIdentifier,
      expectedProducts: [product.normalized],
      expectedMeddraCandidates: [event.meddra],
      expectedNegated: false,
      expectedHypothetical: true,
      expectedPvRelevant: false,
      expectedHumanReview: false,
      tags: [product.normalized, event.tag, "difficult_negative", "hypothetical"],
    };
    return {
      id,
      rawMention: `I had ${product.mention} yesterday and thankfully no ${event.expression}.`,
      authorIdentifier,
      expectedProducts: [product.normalized],
      expectedMeddraCandidates: [event.meddra],
      expectedNegated: true,
      expectedHypothetical: false,
      expectedPvRelevant: false,
      expectedHumanReview: false,
      tags: [product.normalized, event.tag, "difficult_negative", "negated"],
    };
  }));
}

const edgeFixtures: BotulinumPvAcceptanceFixture[] = [
  {
    id: "btx-e2e-050",
    rawMention: "The Botox label says it can cause trouble swallowing.",
    authorIdentifier: "@information_only",
    expectedProducts: ["BOTOX"],
    expectedMeddraCandidates: ["Dysphagia"],
    expectedNegated: false,
    expectedHypothetical: false,
    expectedPvRelevant: false,
    expectedHumanReview: false,
    tags: ["BOTOX", "dysphagia", "difficult_negative", "general_information"],
  },
  {
    id: "btx-e2e-051",
    rawMention: "I had blurry vision for years before I ever received Botox Cosmetic.",
    authorIdentifier: "@historical_context",
    expectedProducts: ["BOTOX COSMETIC"],
    expectedMeddraCandidates: ["Vision blurred"],
    expectedNegated: false,
    expectedHypothetical: false,
    expectedPvRelevant: false,
    expectedHumanReview: false,
    tags: ["BOTOX COSMETIC", "blurred_vision", "difficult_negative", "historical_unrelated"],
  },
  {
    id: "btx-e2e-052",
    rawMention: "Someone posted that a patient had a droopy eyelid after Dysport.",
    authorIdentifier: null,
    expectedProducts: ["DYSPORT"],
    expectedMeddraCandidates: ["Eyelid ptosis"],
    expectedNegated: false,
    expectedHypothetical: false,
    expectedPvRelevant: true,
    expectedHumanReview: true,
    tags: ["DYSPORT", "eyelid_ptosis", "second_hand", "missing_icsr_elements"],
  },
  {
    id: "btx-e2e-053",
    rawMention: "After Botox and Dysport, I developed a droopy eyelid and blurry vision.",
    authorIdentifier: "@multiple_products",
    expectedProducts: ["BOTOX", "DYSPORT"],
    expectedMeddraCandidates: ["Eyelid ptosis", "Vision blurred"],
    expectedNegated: false,
    expectedHypothetical: false,
    expectedPvRelevant: true,
    expectedHumanReview: true,
    tags: ["BOTOX", "DYSPORT", "multiple_drugs", "multiple_events"],
  },
  {
    id: "btx-e2e-054",
    rawMention: "I was given an extra dose of Xeomin by mistake.",
    authorIdentifier: "@special_situation",
    expectedProducts: ["XEOMIN"],
    expectedMeddraCandidates: [],
    expectedNegated: false,
    expectedHypothetical: false,
    expectedPvRelevant: true,
    expectedHumanReview: true,
    tags: ["XEOMIN", "special_situation", "medication_error", "missing_event"],
  },
  {
    id: "btx-e2e-055",
    rawMention: "Daxxify ruined me.",
    authorIdentifier: "@insufficient_event",
    expectedProducts: ["DAXXIFY"],
    expectedMeddraCandidates: [],
    expectedNegated: false,
    expectedHypothetical: false,
    expectedPvRelevant: true,
    expectedHumanReview: true,
    tags: ["DAXXIFY", "insufficient_information", "missing_event"],
  },
  {
    id: "btx-e2e-056",
    rawMention: "My injector warned me that Letybo can cause generalized weakness.",
    authorIdentifier: "@provider_warning",
    expectedProducts: ["LETYBO"],
    expectedMeddraCandidates: ["Muscular weakness"],
    expectedNegated: false,
    expectedHypothetical: false,
    expectedPvRelevant: false,
    expectedHumanReview: false,
    tags: ["LETYBO", "generalized_weakness", "difficult_negative", "provider_warning"],
  },
];

export function botulinumPvEndToEndAcceptanceFixtures() {
  return [...standardFixtures(), ...edgeFixtures];
}
