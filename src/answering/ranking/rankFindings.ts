import type {
  CanonicalFinding,
} from "../models/finding";
import type {
  EvidenceClass,
  EvidenceIntelligence,
} from "../evidence/types";
import type {
  AnswerIntent,
} from "../templates/templateRegistry";
import type {
  IntentRankingRule,
  RankingProfile,
  WeightedTerm,
} from "./types";

type RankFindingsParams = {
  findings: CanonicalFinding[];

  intent: AnswerIntent;

  profile: RankingProfile;

  limit?: number;
};

const EVIDENCE_CLASS_RANK_ADJUSTMENTS: Record<
  EvidenceClass,
  number
> = {
  patient_conversation: 18,

  caregiver_conversation: 15,

  provider_conversation: 18,

  community_conversation: 7,

  research_journal: 18,

  clinical_study: 18,

  government_or_regulator: 15,

  medical_society: 15,

  advocacy_organization: 10,

  healthcare_trade_publication: 8,

  healthcare_news: 5,

  youtube_review: 4,

  forum: 2,

  podcast: 1,

  personal_blog: 0,

  consumer_news: -10,

  influencer_content: -15,

  event_or_conference: -12,

  unknown: -20,

  corporate_pr: -35,

  sponsored_content: -40,

  clinic_marketing: -45,

  retail_or_product: -50,
};

function normalizeText(
  value?: string
): string {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getFindingText(
  finding: CanonicalFinding
): string {
  const value = finding as any;

  return normalizeText(
    [
      value.canonicalClaim,
      value.summary,
      value.title,
      value.description,
      value.text,
      value.excerpt,
      ...(value.labels || []),
      ...(value.normalizedLabels ||
        []),
      ...(value.symptoms || []),
      ...(value.treatments || []),
      ...(value.themes || []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function calculateWeightedTerms(
  text: string,
  terms: WeightedTerm[] = []
): number {
  let score = 0;

  for (const item of terms) {
    if (
      text.includes(
        item.term.toLowerCase()
      )
    ) {
      score += item.weight;
    }
  }

  return score;
}

function matchesHardReject(
  text: string,
  terms: string[] = []
): boolean {
  return terms.some((term) =>
    text.includes(
      term.toLowerCase()
    )
  );
}

function getIntentRule(
  profile: RankingProfile,
  intent: AnswerIntent
): IntentRankingRule {
  return (
    profile.intentRules?.[
      intent
    ] || {}
  );
}

function getBaseScore(
  finding: CanonicalFinding
): number {
  const value = finding as any;

  let score = 0;

  if (
    typeof value.confidence ===
    "number"
  ) {
    score +=
      value.confidence * 10;
  }

  if (
    typeof value.score ===
    "number"
  ) {
    score +=
      Math.min(
        value.score,
        100
      ) / 20;
  }

  if (
    value.sourceType === "live"
  ) {
    score += 1;
  }

  if (
    Array.isArray(
      value.evidence
    ) &&
    value.evidence.length > 0
  ) {
    score += 1;
  }

  return score;
}

function getFindingTypeBoost(
  finding: CanonicalFinding,
  preferredFindingTypes:
    string[] = []
): number {
  const findingType =
    String(
      (finding as any)
        .findingType || ""
    );

  return preferredFindingTypes.includes(
    findingType
  )
    ? 8
    : 0;
}

function getEvidenceIntelligence(
  finding: CanonicalFinding
): EvidenceIntelligence | undefined {
  return (finding as any)
    .evidenceIntelligence;
}

function shouldHardReject(
  intelligence:
    | EvidenceIntelligence
    | undefined
): boolean {
  if (!intelligence) {
    return false;
  }

  return [
    "retail_or_product",
    "clinic_marketing",
    "sponsored_content",
  ].includes(
    intelligence.evidenceClass
  );
}

function getEvidenceAdjustment(
  intelligence:
    | EvidenceIntelligence
    | undefined
): number {
  if (!intelligence) {
    return -5;
  }

  const classAdjustment =
    EVIDENCE_CLASS_RANK_ADJUSTMENTS[
      intelligence.evidenceClass
    ] ?? -5;

  const qualityAdjustment =
    (
      intelligence.qualityScore -
      50
    ) / 5;

  const confidenceAdjustment =
    (
      intelligence
        .classificationConfidence -
      0.5
    ) * 8;

  const socialAuthenticityAdjustment =
    intelligence
      .isAuthenticConversation
      ? intelligence
          .socialAuthenticityScore *
        5
      : 0;

  return (
    classAdjustment +
    qualityAdjustment +
    confidenceAdjustment +
    socialAuthenticityAdjustment
  );
}

function uniqueByClaim(
  findings: CanonicalFinding[]
): CanonicalFinding[] {
  const seen =
    new Set<string>();

  const unique:
    CanonicalFinding[] = [];

  for (const finding of findings) {
    const value = finding as any;

    const claim =
      normalizeText(
        value.canonicalClaim ||
          value.summary ||
          value.title ||
          value.description
      );

    if (!claim) {
      continue;
    }

    const key =
      claim.slice(0, 180);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    unique.push(finding);
  }

  return unique;
}

export function rankFindings({
  findings,
  intent,
  profile,
  limit = 50,
}: RankFindingsParams): CanonicalFinding[] {
  const intentRule =
    getIntentRule(
      profile,
      intent
    );

  const ranked = findings
    .map((finding) => {
      const text =
        getFindingText(finding);

      const intelligence =
        getEvidenceIntelligence(
          finding
        );

      if (
        shouldHardReject(
          intelligence
        )
      ) {
        return null;
      }

      const hardRejected =
        matchesHardReject(
          text,
          profile.globalHardRejectTerms
        ) ||
        matchesHardReject(
          text,
          intentRule.hardRejectTerms
        );

      if (hardRejected) {
        return null;
      }

      const boostScore =
        calculateWeightedTerms(
          text,
          profile.globalBoosts
        ) +
        calculateWeightedTerms(
          text,
          intentRule.boosts
        ) +
        getFindingTypeBoost(
          finding,
          intentRule.preferredFindingTypes
        );

      const penaltyScore =
        calculateWeightedTerms(
          text,
          profile.globalPenalties
        ) +
        calculateWeightedTerms(
          text,
          intentRule.penalties
        );

      const evidenceAdjustment =
        getEvidenceAdjustment(
          intelligence
        );

      return {
        finding,

        rankScore:
          getBaseScore(finding) +
          boostScore -
          penaltyScore +
          evidenceAdjustment,
      };
    })
    .filter(
      (
        item
      ): item is {
        finding: CanonicalFinding;

        rankScore: number;
      } =>
        Boolean(
          item &&
            item.rankScore > 0
        )
    )
    .sort(
      (first, second) =>
        second.rankScore -
        first.rankScore
    )
    .map(
      (item) =>
        item.finding
    );

  return uniqueByClaim(
    ranked
  ).slice(0, limit);
}