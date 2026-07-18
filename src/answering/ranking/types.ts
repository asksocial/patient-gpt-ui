import { AnswerIntent } from "../templates/templateRegistry";

export type WeightedTerm = {
  term: string;
  weight: number;
};

export type IntentRankingRule = {
  preferredFindingTypes?: string[];
  boosts?: WeightedTerm[];
  penalties?: WeightedTerm[];
  hardRejectTerms?: string[];
};

export type RankingProfile = {
  profileId: string;

  globalBoosts?: WeightedTerm[];
  globalPenalties?: WeightedTerm[];
  globalHardRejectTerms?: string[];

  intentRules?: Partial<
    Record<AnswerIntent, IntentRankingRule>
  >;
};

export type RankedFinding<T> = {
  finding: T;
  rankScore: number;
};