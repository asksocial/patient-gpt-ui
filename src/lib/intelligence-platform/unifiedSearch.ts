import type {
  Citation,
} from "./evidence";
import type {
  KnowledgeEntityType,
} from "./knowledgeGraph";
import type {
  IntelligenceModuleId,
} from "./ids";

export type UnifiedSearchMode =
  | "keyword"
  | "semantic"
  | "graph";

export type EvidenceLevel =
  | "primary"
  | "secondary"
  | "observational"
  | "unverified";

export type UnifiedSearchDocument = {
  id: string;
  organizationId: string;
  moduleIds:
    IntelligenceModuleId[];
  permissionTags: string[];
  title: string;
  text: string;
  entityType?:
    KnowledgeEntityType;
  entityIds: string[];
  geography?: string;
  publishedAt?: string;
  sourceId: string;
  sourceType: string;
  url?: string;
  confidence: number;
  evidenceLevel:
    EvidenceLevel;
  embedding?: number[];
};

export type UnifiedSearchContext = {
  organizationId: string;
  moduleIds:
    IntelligenceModuleId[];
  permissionTags: string[];
};

export type UnifiedSearchFilters = {
  moduleIds?:
    IntelligenceModuleId[];
  entityTypes?:
    KnowledgeEntityType[];
  geographies?: string[];
  dateFrom?: string;
  dateTo?: string;
  sourceIds?: string[];
  minimumConfidence?: number;
  evidenceLevels?:
    EvidenceLevel[];
  permissionBoundary?: string[];
};

export type UnifiedSearchRequest = {
  mode: UnifiedSearchMode;
  query: string;
  context: UnifiedSearchContext;
  filters?:
    UnifiedSearchFilters;
  queryEmbedding?: number[];
  graphEntityIds?: string[];
  limit?: number;
};

export type UnifiedSearchHit = {
  document:
    UnifiedSearchDocument;
  score: number;
  matchedBy:
    UnifiedSearchMode;
  citation: Citation;
};

function cosineSimilarity(
  left: number[],
  right: number[]
) {
  if (
    left.length === 0 ||
    left.length !== right.length
  ) {
    return 0;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (
    let index = 0;
    index < left.length;
    index += 1
  ) {
    dot +=
      left[index] * right[index];
    leftNorm +=
      left[index] * left[index];
    rightNorm +=
      right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) {
    return 0;
  }
  return (
    dot /
    (Math.sqrt(leftNorm) *
      Math.sqrt(rightNorm))
  );
}

function keywordScore(
  query: string,
  document:
    UnifiedSearchDocument
) {
  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(
          (term) =>
            term.length > 1
        )
    )
  );
  if (!terms.length) {
    return 0;
  }
  const title =
    document.title.toLowerCase();
  const text =
    document.text.toLowerCase();
  const matched = terms.reduce(
    (score, term) =>
      score +
      (title.includes(term)
        ? 2
        : 0) +
      (text.includes(term) ? 1 : 0),
    0
  );
  return matched / (terms.length * 3);
}

function isPermitted(
  document:
    UnifiedSearchDocument,
  request: UnifiedSearchRequest
) {
  const {
    context,
    filters = {},
  } = request;
  if (
    document.organizationId !==
    context.organizationId
  ) {
    return false;
  }
  if (
    !document.moduleIds.some(
      (moduleId) =>
        context.moduleIds.includes(
          moduleId
        )
    )
  ) {
    return false;
  }
  if (
    !document.permissionTags.every(
      (tag) =>
        context.permissionTags.includes(
          tag
        )
    )
  ) {
    return false;
  }
  if (
    filters.permissionBoundary &&
    !filters.permissionBoundary.every(
      (tag) =>
        context.permissionTags.includes(
          tag
        )
    )
  ) {
    return false;
  }
  if (
    filters.moduleIds?.length &&
    !document.moduleIds.some(
      (moduleId) =>
        filters.moduleIds?.includes(
          moduleId
        )
    )
  ) {
    return false;
  }
  if (
    filters.entityTypes?.length &&
    (!document.entityType ||
      !filters.entityTypes.includes(
        document.entityType
      ))
  ) {
    return false;
  }
  if (
    filters.geographies?.length &&
    (!document.geography ||
      !filters.geographies.includes(
        document.geography
      ))
  ) {
    return false;
  }
  if (
    filters.sourceIds?.length &&
    !filters.sourceIds.includes(
      document.sourceId
    )
  ) {
    return false;
  }
  if (
    document.confidence <
    (filters.minimumConfidence ||
      0)
  ) {
    return false;
  }
  if (
    filters.evidenceLevels
      ?.length &&
    !filters.evidenceLevels.includes(
      document.evidenceLevel
    )
  ) {
    return false;
  }
  if (
    filters.dateFrom &&
    (!document.publishedAt ||
      document.publishedAt <
        filters.dateFrom)
  ) {
    return false;
  }
  if (
    filters.dateTo &&
    (!document.publishedAt ||
      document.publishedAt >
        filters.dateTo)
  ) {
    return false;
  }
  return true;
}

function toCitation(
  document:
    UnifiedSearchDocument
): Citation {
  return {
    evidenceId: document.id,
    sourceId: document.sourceId,
    title: document.title,
    sourceType:
      document.sourceType,
    excerpt:
      document.text.slice(
        0,
        500
      ),
    url: document.url,
    publishedAt:
      document.publishedAt,
  };
}

export class UnifiedSearchService {
  constructor(
    private readonly documents:
      UnifiedSearchDocument[]
  ) {}

  search(
    request:
      UnifiedSearchRequest
  ): UnifiedSearchHit[] {
    if (
      request.mode ===
        "semantic" &&
      !request.queryEmbedding
    ) {
      throw new Error(
        "Semantic search requires a query embedding."
      );
    }
    if (
      request.mode === "graph" &&
      !request.graphEntityIds
        ?.length
    ) {
      throw new Error(
        "Graph search requires at least one entity ID."
      );
    }

    const graphEntityIds =
      new Set(
        request.graphEntityIds ||
          []
      );
    return this.documents
      .filter((document) =>
        isPermitted(
          document,
          request
        )
      )
      .map((document) => {
        let score = 0;
        if (
          request.mode ===
          "keyword"
        ) {
          score = keywordScore(
            request.query,
            document
          );
        } else if (
          request.mode ===
          "semantic"
        ) {
          score =
            document.embedding
              ? cosineSimilarity(
                  request.queryEmbedding!,
                  document.embedding
                )
              : 0;
        } else {
          const matches =
            document.entityIds.filter(
              (entityId) =>
                graphEntityIds.has(
                  entityId
                )
            ).length;
          score =
            matches /
            Math.max(
              1,
              graphEntityIds.size
            );
        }
        return {
          document,
          score,
          matchedBy:
            request.mode,
          citation:
            toCitation(document),
        };
      })
      .filter(
        (hit) => hit.score > 0
      )
      .sort(
        (left, right) =>
          right.score -
          left.score
      )
      .slice(
        0,
        Math.max(
          1,
          request.limit || 20
        )
      );
  }
}
