import type {
  IntelligenceModuleId,
} from "./ids";

export type CrossModuleSourceContext = {
  sourceId: string;
  moduleId:
    IntelligenceModuleId;
  sourceType: string;
  summary: string;
};

export type CrossModuleRequest = {
  organizationId: string;
  requestedModuleIds:
    IntelligenceModuleId[];
  permittedModuleIds:
    IntelligenceModuleId[];
  explicitlyApprovedModuleIds:
    IntelligenceModuleId[];
  sources:
    CrossModuleSourceContext[];
};

export type CrossModuleDisclosure = {
  organizationId: string;
  modulesUsed:
    IntelligenceModuleId[];
  sourcesUsed: Array<{
    sourceId: string;
    sourceType: string;
    moduleId:
      IntelligenceModuleId;
  }>;
  excludedModules: Array<{
    moduleId:
      IntelligenceModuleId;
    reason:
      | "not_permitted"
      | "not_explicitly_approved";
  }>;
};

export type AuthorizedCrossModuleContext = {
  contexts:
    CrossModuleSourceContext[];
  disclosure:
    CrossModuleDisclosure;
};

export function authorizeCrossModuleContext(
  request: CrossModuleRequest
): AuthorizedCrossModuleContext {
  const permitted = new Set(
    request.permittedModuleIds
  );
  const explicitlyApproved =
    new Set(
      request.explicitlyApprovedModuleIds
    );
  const modulesUsed:
    IntelligenceModuleId[] = [];
  const excludedModules:
    CrossModuleDisclosure["excludedModules"] =
    [];

  for (const moduleId of
    Array.from(
      new Set(
        request.requestedModuleIds
      )
    )) {
    if (
      !permitted.has(moduleId)
    ) {
      excludedModules.push({
        moduleId,
        reason: "not_permitted",
      });
    } else if (
      !explicitlyApproved.has(
        moduleId
      )
    ) {
      excludedModules.push({
        moduleId,
        reason:
          "not_explicitly_approved",
      });
    } else {
      modulesUsed.push(moduleId);
    }
  }

  const included = new Set(
    modulesUsed
  );
  const contexts =
    request.sources.filter(
      (source) =>
        included.has(
          source.moduleId
        )
    );

  return {
    contexts,
    disclosure: {
      organizationId:
        request.organizationId,
      modulesUsed,
      sourcesUsed: contexts.map(
        (source) => ({
          sourceId:
            source.sourceId,
          sourceType:
            source.sourceType,
          moduleId:
            source.moduleId,
        })
      ),
      excludedModules,
    },
  };
}

export function formatCrossModuleDisclosure(
  disclosure:
    CrossModuleDisclosure
) {
  const modules =
    disclosure.modulesUsed.length
      ? disclosure.modulesUsed.join(
          ", "
        )
      : "none";
  const sources =
    disclosure.sourcesUsed.length;
  const excluded =
    disclosure.excludedModules
      .map(
        (item) =>
          `${item.moduleId} (${item.reason})`
      )
      .join(", ");
  return [
    `Modules used: ${modules}.`,
    `Sources used: ${sources}.`,
    excluded
      ? `Excluded context: ${excluded}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
