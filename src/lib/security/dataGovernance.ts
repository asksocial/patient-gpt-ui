export type DataGovernancePolicy = {
  dataResidency:
    | "us"
    | "eu"
    | "uk"
    | "canada"
    | "customer_managed";
  retentionDays: number;
  deletionGraceDays: number;
  encryptionInTransitRequired: true;
  encryptionAtRestRequired: true;
  protectedDataAllowed: boolean;
  immutableAuditRequired: boolean;
};

export function validateDataGovernancePolicy(
  policy: DataGovernancePolicy
) {
  const issues: string[] = [];
  if (
    !Number.isInteger(
      policy.retentionDays
    ) ||
    policy.retentionDays < 1
  ) {
    issues.push(
      "retentionDays must be a positive integer."
    );
  }
  if (
    !Number.isInteger(
      policy.deletionGraceDays
    ) ||
    policy.deletionGraceDays < 0
  ) {
    issues.push(
      "deletionGraceDays must be a non-negative integer."
    );
  }
  if (
    !policy.encryptionInTransitRequired ||
    !policy.encryptionAtRestRequired
  ) {
    issues.push(
      "Encryption in transit and at rest must be required."
    );
  }
  return issues;
}

export function getDeletionDate(
  createdAt: string,
  policy: DataGovernancePolicy
) {
  const date = new Date(
    createdAt
  );
  date.setUTCDate(
    date.getUTCDate() +
      policy.retentionDays +
      policy.deletionGraceDays
  );
  return date.toISOString();
}
