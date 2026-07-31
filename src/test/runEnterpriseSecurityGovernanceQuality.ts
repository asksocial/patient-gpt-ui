import {
  authorizeAccess,
  getDeletionDate,
  ImmutableAuditLedger,
  InMemoryScimDirectory,
  validateDataGovernancePolicy,
} from "../lib/security";

const subject = {
  userId: "user_1",
  organizationId: "org_1",
  workspaceIds: [
    "workspace_1",
  ],
  moduleIds: [
    "medical_affairs" as const,
  ],
  roles: ["analyst"],
  attributes: {
    geography: ["US", "CA"],
  },
  allowedFields: [
    "summary",
  ],
  protectedDataAllowed: false,
};

const allowed =
  authorizeAccess(
    subject,
    {
      organizationId: "org_1",
      workspaceId:
        "workspace_1",
      moduleId:
        "medical_affairs",
      field: "summary",
      requiredAttributes: {
        geography: "US",
      },
    },
    "read"
  );
const crossTenant =
  authorizeAccess(
    subject,
    {
      organizationId: "org_2",
    },
    "read"
  );
const protectedData =
  authorizeAccess(
    subject,
    {
      organizationId: "org_1",
      containsProtectedData: true,
    },
    "read"
  );
const restrictedField =
  authorizeAccess(
    subject,
    {
      organizationId: "org_1",
      field: "patient_name",
    },
    "read"
  );
const exportDenied =
  authorizeAccess(
    subject,
    {
      organizationId: "org_1",
      sourceUsageRestrictions: [
        "no_export",
      ],
    },
    "export"
  );

if (
  !allowed.allowed ||
  crossTenant.allowed ||
  protectedData.allowed ||
  restrictedField.allowed ||
  exportDenied.allowed
) {
  throw new Error(
    "Tenant, protected-data, field, and source restrictions must be enforced."
  );
}

const ledger =
  new ImmutableAuditLedger();
ledger.append({
  organizationId: "org_1",
  actorId: "user_1",
  action: "read",
  resourceType: "report",
  resourceId: "report_1",
  outcome: "allowed",
  occurredAt:
    "2026-07-30T12:00:00.000Z",
});
ledger.append({
  organizationId: "org_1",
  actorId: "user_1",
  action: "export",
  resourceType: "report",
  resourceId: "report_1",
  outcome: "denied",
  occurredAt:
    "2026-07-30T12:01:00.000Z",
});

const tampered = ledger
  .list()
  .map((event) => ({
    ...event,
  }));
tampered[1] = {
  ...tampered[1],
  outcome: "allowed",
};

if (
  !ledger.verify() ||
  ledger.verify(tampered)
) {
  throw new Error(
    "The audit ledger must detect mutation or chain tampering."
  );
}

const directory =
  new InMemoryScimDirectory();
directory.apply({
  type: "upsert",
  identity: {
    externalId: "external_1",
    userId: "user_1",
    organizationId: "org_1",
    email: "user@example.com",
    displayName: "User One",
    active: true,
    groups: [
      "medical-affairs",
    ],
    updatedAt:
      "2026-07-30T12:00:00.000Z",
  },
});
directory.apply({
  type: "deactivate",
  externalId: "external_1",
  organizationId: "org_1",
  occurredAt:
    "2026-07-30T13:00:00.000Z",
});

if (
  directory.list("org_1")[0]
    ?.active !== false
) {
  throw new Error(
    "SCIM deactivation must revoke an identity without losing its audit identity."
  );
}

const governancePolicy = {
  dataResidency: "us" as const,
  retentionDays: 365,
  deletionGraceDays: 30,
  encryptionInTransitRequired:
    true as const,
  encryptionAtRestRequired:
    true as const,
  protectedDataAllowed: false,
  immutableAuditRequired: true,
};

if (
  validateDataGovernancePolicy(
    governancePolicy
  ).length ||
  getDeletionDate(
    "2026-01-01T00:00:00.000Z",
    governancePolicy
  ) !==
    "2027-01-31T00:00:00.000Z"
) {
  throw new Error(
    "Retention, deletion, residency, and encryption policy must validate deterministically."
  );
}

console.log(
  JSON.stringify(
    {
      tenantIsolation:
        !crossTenant.allowed,
      protectedDataControl:
        !protectedData.allowed,
      auditChainValid:
        ledger.verify(),
      scimIdentityActive:
        directory.list(
          "org_1"
        )[0]?.active,
      deletionDate:
        getDeletionDate(
          "2026-01-01T00:00:00.000Z",
          governancePolicy
        ),
    },
    null,
    2
  )
);
