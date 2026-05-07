import { buildRenderedAnswer } from "./rendering/buildRenderedAnswer";
import { CanonicalFinding } from "./models/finding";

export function assembleAnswer(params: {
  question: string;
  intent: string;
  findings: CanonicalFinding[];
  debug: any;
  liveDataStatus: "not_found" | "extends" | "only";
}) {
  const { findings, debug, liveDataStatus } = params;

  // 🚨 THIS MUST CALL THE GUARDED RENDERER
  const rendered = buildRenderedAnswer(
    findings,
    debug,
    liveDataStatus
  );

  return rendered;
}