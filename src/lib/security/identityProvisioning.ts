export type ProvisionedIdentity = {
  externalId: string;
  userId: string;
  organizationId: string;
  email: string;
  displayName: string;
  active: boolean;
  groups: string[];
  updatedAt: string;
};

export type ScimProvisioningOperation =
  | {
      type: "upsert";
      identity:
        ProvisionedIdentity;
    }
  | {
      type: "deactivate";
      externalId: string;
      organizationId: string;
      occurredAt: string;
    };

export class InMemoryScimDirectory {
  private readonly identities =
    new Map<
      string,
      ProvisionedIdentity
    >();

  apply(
    operation:
      ScimProvisioningOperation
  ) {
    const organizationId =
      operation.type === "upsert"
        ? operation.identity
            .organizationId
        : operation.organizationId;
    const key =
      `${organizationId}:${
        operation.type === "upsert"
          ? operation.identity
              .externalId
          : operation.externalId
      }`;
    if (
      operation.type ===
      "upsert"
    ) {
      this.identities.set(
        key,
        Object.freeze({
          ...operation.identity,
          groups: Object.freeze([
            ...operation.identity
              .groups,
          ]) as unknown as string[],
        })
      );
    } else {
      const existing =
        this.identities.get(key);
      if (existing) {
        this.identities.set(
          key,
          Object.freeze({
            ...existing,
            active: false,
            updatedAt:
              operation.occurredAt,
          })
        );
      }
    }
    return this.identities.get(key);
  }

  list(
    organizationId: string
  ) {
    return Array.from(
      this.identities.values()
    ).filter(
      (identity) =>
        identity.organizationId ===
        organizationId
    );
  }
}
