import type {
  IntelligenceModuleId,
} from "../intelligence-platform";

export type SecurityAction =
  | "read"
  | "search"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "approve"
  | "administer";

export type SecuritySubject = {
  userId: string;
  organizationId: string;
  workspaceIds: string[];
  moduleIds:
    IntelligenceModuleId[];
  roles: string[];
  attributes: Record<
    string,
    string | string[] | boolean
  >;
  allowedFields?: string[];
  protectedDataAllowed: boolean;
};

export type SecurityResource = {
  organizationId: string;
  workspaceId?: string;
  moduleId?:
    IntelligenceModuleId;
  recordId?: string;
  field?: string;
  containsProtectedData?: boolean;
  requiredAttributes?: Record<
    string,
    string | string[]
  >;
  sourceUsageRestrictions?: Array<
    | "no_ai"
    | "no_export"
    | "human_review_required"
  >;
};

export type AuthorizationDecision = {
  allowed: boolean;
  reason: string;
  requiresHumanReview: boolean;
};

const ROLE_ACTIONS: Record<
  string,
  SecurityAction[]
> = {
  viewer: ["read", "search"],
  analyst: [
    "read",
    "search",
    "create",
    "update",
    "export",
  ],
  approver: [
    "read",
    "search",
    "approve",
  ],
  administrator: [
    "read",
    "search",
    "create",
    "update",
    "delete",
    "export",
    "approve",
    "administer",
  ],
};

function hasRequiredAttributes(
  subject: SecuritySubject,
  resource: SecurityResource
) {
  return Object.entries(
    resource.requiredAttributes ||
      {}
  ).every(
    ([key, required]) => {
      const actual =
        subject.attributes[key];
      const requiredValues =
        Array.isArray(required)
          ? required
          : [required];
      const actualValues =
        Array.isArray(actual)
          ? actual
          : actual === undefined
            ? []
            : [String(actual)];
      return requiredValues.some(
        (value) =>
          actualValues.includes(
            value
          )
      );
    }
  );
}

export function authorizeAccess(
  subject: SecuritySubject,
  resource: SecurityResource,
  action: SecurityAction
): AuthorizationDecision {
  if (
    subject.organizationId !==
    resource.organizationId
  ) {
    return {
      allowed: false,
      reason:
        "Tenant boundary mismatch.",
      requiresHumanReview:
        false,
    };
  }

  if (
    resource.workspaceId &&
    !subject.workspaceIds.includes(
      resource.workspaceId
    )
  ) {
    return {
      allowed: false,
      reason:
        "Workspace access is not assigned.",
      requiresHumanReview:
        false,
    };
  }

  if (
    resource.moduleId &&
    !subject.moduleIds.includes(
      resource.moduleId
    )
  ) {
    return {
      allowed: false,
      reason:
        "Module access is not assigned.",
      requiresHumanReview:
        false,
    };
  }

  if (
    resource.field &&
    subject.allowedFields &&
    !subject.allowedFields.includes(
      resource.field
    )
  ) {
    return {
      allowed: false,
      reason:
        "Field access is not assigned.",
      requiresHumanReview:
        false,
    };
  }

  if (
    resource.containsProtectedData &&
    !subject.protectedDataAllowed
  ) {
    return {
      allowed: false,
      reason:
        "Protected health information access is not permitted.",
      requiresHumanReview:
        false,
    };
  }

  if (
    !hasRequiredAttributes(
      subject,
      resource
    )
  ) {
    return {
      allowed: false,
      reason:
        "Required resource attributes are not satisfied.",
      requiresHumanReview:
        false,
    };
  }

  if (
    resource.sourceUsageRestrictions?.includes(
      "no_ai"
    ) &&
    action !== "read"
  ) {
    return {
      allowed: false,
      reason:
        "Source usage restrictions prohibit AI processing.",
      requiresHumanReview:
        false,
    };
  }

  if (
    resource.sourceUsageRestrictions?.includes(
      "no_export"
    ) &&
    action === "export"
  ) {
    return {
      allowed: false,
      reason:
        "Source usage restrictions prohibit export.",
      requiresHumanReview:
        false,
    };
  }

  const actionAllowed =
    subject.roles.some((role) =>
      (
        ROLE_ACTIONS[role] || []
      ).includes(action)
    );
  if (!actionAllowed) {
    return {
      allowed: false,
      reason:
        "Role does not permit the requested action.",
      requiresHumanReview:
        false,
    };
  }

  return {
    allowed: true,
    reason: "Access granted.",
    requiresHumanReview:
      resource.sourceUsageRestrictions?.includes(
        "human_review_required"
      ) || false,
  };
}
