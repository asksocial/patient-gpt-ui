import { ingestCurated } from "./curated";
import {
  adaptMeltwaterRows,
  MeltwaterRow,
  parseMeltwaterCsv,
} from "./adapters/meltwaterAdapter";
import { getDiseaseProfile } from "./profiles";
import { IngestionContext } from "./types";

export function ingestMeltwaterCsv(
  filePath: string,
  context: IngestionContext & { profileId: string }
): any[] {
  const rows: MeltwaterRow[] = parseMeltwaterCsv(filePath);
  const profile = getDiseaseProfile(context.profileId);

  const curatedCards = ingestCurated(context.profileId);

  const liveCards = adaptMeltwaterRows(rows, {
    ...context,
    profile,
  });

  return [...curatedCards, ...liveCards];
}