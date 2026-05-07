import { IngestionContext } from "../types";

export interface CuratedInputCard {
  id?: string;
  title?: string;
  summary?: string;
  description?: string;
  text?: string;
  excerpt?: string;
  snippet?: string;

  labels?: string[];
  findingType?: string;
  therapeuticArea?: string;

  country?: string | string[];
  persona?: string | string[];
  platform?: string | string[];
  symptoms?: string[];
  treatments?: string[];
  lifecycleStage?: string | string[];

  confidence?: number;
  score?: number;

  sourceType?: "curated" | "live";
  sourceId?: string;
  documentId?: string;
  sectionId?: string;
  sectionTitle?: string;
  url?: string;

  evidence?: Array<{
    sourceType?: "curated" | "live";
    sourceId?: string;
    documentId?: string;
    sectionId?: string;
    sectionTitle?: string;
    excerpt?: string;
    url?: string;
    country?: string;
    platform?: string;
    persona?: string;
    score?: number;
  }>;
}

export function adaptCuratedCards(
  cards: CuratedInputCard[],
  context: IngestionContext
): any[] {
  return cards.map((card, index) => ({
    ...card,
    id: card.id || `curated-${index + 1}`,
    therapeuticArea: card.therapeuticArea || context.therapeuticArea || "unknown",
    sourceType: card.sourceType || "curated",
    sourceId: card.sourceId || card.id || `curated-source-${index + 1}`,
  }));
}