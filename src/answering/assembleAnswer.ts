import {
  buildRenderedAnswer,
} from "./rendering/buildRenderedAnswer";
import {
  CanonicalFinding,
} from "./models/finding";
import {
  ThemeMatch,
  ThemeLongitudinalTracking,
  ThemeRelationship,
} from "./themes/themeModels";

export function assembleAnswer(params: {
  question: string;
  intent: string;
  findings: CanonicalFinding[];
  themeSummary?: ThemeMatch[];
  themeRelationships?: ThemeRelationship[];
  themeLongitudinalTracking?:
    ThemeLongitudinalTracking;
  debug: any;
  liveDataStatus:
    | "not_found"
    | "extends"
    | "only";
}) {
  const {
    intent,
    findings,
    themeSummary = [],
    themeRelationships = [],
    themeLongitudinalTracking,
    debug,
    liveDataStatus,
  } = params;

  return buildRenderedAnswer(
    findings,
    debug,
    liveDataStatus,
    themeSummary,
    themeRelationships,
    intent,
    themeLongitudinalTracking
  );
}
