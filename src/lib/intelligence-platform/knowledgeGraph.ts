import type {
  IntelligenceModuleId,
} from "./ids";

export const KNOWLEDGE_ENTITY_TYPES = [
  "organization",
  "brand",
  "product",
  "disease",
  "treatment",
  "clinical_trial",
  "investigator",
  "healthcare_professional",
  "patient_population",
  "institution",
  "publication",
  "congress",
  "advocacy_organization",
  "claim",
  "evidence",
  "safety_event",
] as const;

export type KnowledgeEntityType =
  (typeof KNOWLEDGE_ENTITY_TYPES)[number];

export type KnowledgeProvenance = {
  sourceId: string;
  documentId: string;
  observedAt: string;
  excerpt?: string;
  url?: string;
  usageRestrictions?: string[];
};

export type KnowledgeAccessBoundary = {
  organizationId: string;
  moduleIds:
    IntelligenceModuleId[];
  permissionTags: string[];
};

export type KnowledgeEntity = {
  id: string;
  type: KnowledgeEntityType;
  name: string;
  aliases?: string[];
  attributes: Record<
    string,
    unknown
  >;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  provenance:
    KnowledgeProvenance[];
  access: KnowledgeAccessBoundary;
};

export type KnowledgeRelationship = {
  id: string;
  type: string;
  fromEntityId: string;
  toEntityId: string;
  attributes: Record<
    string,
    unknown
  >;
  confidence: number;
  validFrom?: string;
  validTo?: string;
  observedAt: string;
  provenance:
    KnowledgeProvenance[];
  access: KnowledgeAccessBoundary;
};

export type KnowledgeDocumentMapping = {
  documentId: string;
  title: string;
  ingestedAt: string;
  entityIds: string[];
  relationshipIds: string[];
  claimEntityIds: string[];
  evidenceEntityIds: string[];
  provenance:
    KnowledgeProvenance;
  access: KnowledgeAccessBoundary;
};

export type KnowledgeGraphBundle = {
  entities: KnowledgeEntity[];
  relationships:
    KnowledgeRelationship[];
  documents:
    KnowledgeDocumentMapping[];
};

export type KnowledgeGraphIssue = {
  path: string;
  message: string;
};

function isTimestamp(
  value: string
) {
  return !Number.isNaN(
    Date.parse(value)
  );
}

function validateConfidence(
  value: number,
  path: string,
  issues: KnowledgeGraphIssue[]
) {
  if (
    value < 0 ||
    value > 1
  ) {
    issues.push({
      path,
      message:
        "Confidence must be between 0 and 1.",
    });
  }
}

export function validateKnowledgeGraphBundle(
  bundle: KnowledgeGraphBundle
): KnowledgeGraphIssue[] {
  const issues:
    KnowledgeGraphIssue[] = [];
  const entityIds = new Set(
    bundle.entities.map(
      (entity) => entity.id
    )
  );
  const relationshipIds =
    new Set(
      bundle.relationships.map(
        (relationship) =>
          relationship.id
      )
    );

  bundle.entities.forEach(
    (entity, index) => {
      validateConfidence(
        entity.confidence,
        `entities.${index}.confidence`,
        issues
      );
      if (
        !isTimestamp(
          entity.createdAt
        ) ||
        !isTimestamp(
          entity.updatedAt
        )
      ) {
        issues.push({
          path: `entities.${index}`,
          message:
            "Entity timestamps must be valid.",
        });
      }
      if (
        entity.provenance
          .length === 0
      ) {
        issues.push({
          path: `entities.${index}.provenance`,
          message:
            "Every entity requires provenance.",
        });
      }
    }
  );

  bundle.relationships.forEach(
    (relationship, index) => {
      validateConfidence(
        relationship.confidence,
        `relationships.${index}.confidence`,
        issues
      );
      if (
        !entityIds.has(
          relationship.fromEntityId
        ) ||
        !entityIds.has(
          relationship.toEntityId
        )
      ) {
        issues.push({
          path: `relationships.${index}`,
          message:
            "Relationship endpoints must reference entities in the bundle.",
        });
      }
      if (
        !isTimestamp(
          relationship.observedAt
        )
      ) {
        issues.push({
          path: `relationships.${index}.observedAt`,
          message:
            "Relationship observedAt must be valid.",
        });
      }
    }
  );

  bundle.documents.forEach(
    (document, index) => {
      const mappedEntityIds = [
        ...document.entityIds,
        ...document.claimEntityIds,
        ...document.evidenceEntityIds,
      ];
      if (
        mappedEntityIds.length ===
        0
      ) {
        issues.push({
          path: `documents.${index}`,
          message:
            "Every document must map to at least one entity, claim, or evidence record.",
        });
      }
      for (const entityId of
        mappedEntityIds) {
        if (
          !entityIds.has(entityId)
        ) {
          issues.push({
            path: `documents.${index}`,
            message:
              `Unknown entity: ${entityId}`,
          });
        }
      }
      for (const relationshipId of
        document.relationshipIds) {
        if (
          !relationshipIds.has(
            relationshipId
          )
        ) {
          issues.push({
            path: `documents.${index}`,
            message:
              `Unknown relationship: ${relationshipId}`,
          });
        }
      }
    }
  );

  return issues;
}

function hasAccess(
  record: KnowledgeAccessBoundary,
  context: KnowledgeAccessBoundary
) {
  return (
    record.organizationId ===
      context.organizationId &&
    record.moduleIds.some(
      (moduleId) =>
        context.moduleIds.includes(
          moduleId
        )
    ) &&
    record.permissionTags.every(
      (tag) =>
        context.permissionTags.includes(
          tag
        )
    )
  );
}

export class InMemoryKnowledgeGraph {
  private readonly entities =
    new Map<
      string,
      KnowledgeEntity
    >();
  private readonly relationships =
    new Map<
      string,
      KnowledgeRelationship
    >();
  private readonly documents =
    new Map<
      string,
      KnowledgeDocumentMapping
    >();

  ingest(
    bundle: KnowledgeGraphBundle
  ) {
    const issues =
      validateKnowledgeGraphBundle(
        bundle
      );
    if (issues.length) {
      throw new Error(
        issues
          .map(
            (issue) =>
              `${issue.path}: ${issue.message}`
          )
          .join("; ")
      );
    }

    bundle.entities.forEach(
      (entity) =>
        this.entities.set(
          entity.id,
          Object.freeze({
            ...entity,
          })
        )
    );
    bundle.relationships.forEach(
      (relationship) =>
        this.relationships.set(
          relationship.id,
          Object.freeze({
            ...relationship,
          })
        )
    );
    bundle.documents.forEach(
      (document) =>
        this.documents.set(
          document.documentId,
          Object.freeze({
            ...document,
          })
        )
    );
  }

  traverse(params: {
    entityIds: string[];
    context:
      KnowledgeAccessBoundary;
    depth?: number;
  }) {
    const depth = Math.max(
      1,
      Math.min(params.depth || 1, 4)
    );
    const visited = new Set(
      params.entityIds
    );
    let frontier = new Set(
      params.entityIds
    );
    const relationships:
      KnowledgeRelationship[] = [];

    for (
      let level = 0;
      level < depth;
      level += 1
    ) {
      const next =
        new Set<string>();
      for (const relationship of
        this.relationships.values()) {
        if (
          !hasAccess(
            relationship.access,
            params.context
          )
        ) {
          continue;
        }
        if (
          frontier.has(
            relationship.fromEntityId
          ) ||
          frontier.has(
            relationship.toEntityId
          )
        ) {
          relationships.push(
            relationship
          );
          for (const entityId of [
            relationship.fromEntityId,
            relationship.toEntityId,
          ]) {
            if (
              !visited.has(entityId)
            ) {
              visited.add(entityId);
              next.add(entityId);
            }
          }
        }
      }
      frontier = next;
    }

    return {
      entities: Array.from(
        visited
      )
        .map((id) =>
          this.entities.get(id)
        )
        .filter(
          (
            entity
          ): entity is KnowledgeEntity =>
            !!entity &&
            hasAccess(
              entity.access,
              params.context
            )
        ),
      relationships,
      documents: Array.from(
        this.documents.values()
      ).filter(
        (document) =>
          hasAccess(
            document.access,
            params.context
          ) &&
          [
            ...document.entityIds,
            ...document.claimEntityIds,
            ...document.evidenceEntityIds,
          ].some((id) =>
            visited.has(id)
          )
      ),
    };
  }
}
