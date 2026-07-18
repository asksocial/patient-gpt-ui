import {
  resolveEntitlements,
} from "../lib/entitlements";

const organizationGrant =
  resolveEntitlements({
    userId: "user_test",
    organizationId: "org_test",
    organizationMetadata: {
      grants: [
        "knowledge_intelligence",
        "exports",
      ],
      denials: [
        "executive_intelligence",
      ],
      attributes: {
        exports: {
          formats: ["pdf", "csv"],
        },
      },
    },
    knowledgePersistenceEnabled:
      true,
  });

if (
  !organizationGrant.capabilities
    .knowledge_intelligence.granted ||
  organizationGrant.capabilities
    .executive_intelligence.granted ||
  organizationGrant.capabilities
    .exports.source !==
    "organization"
) {
  throw new Error(
    "Organization entitlement grants and denials were not resolved correctly."
  );
}

const userOverride =
  resolveEntitlements({
    userId: "user_test",
    organizationId: "org_test",
    organizationMetadata: {
      grants: ["exports"],
      denials: [
        "executive_intelligence",
      ],
    },
    userMetadata: {
      grants: [
        "executive_intelligence",
      ],
      denials: ["exports"],
    },
    knowledgePersistenceEnabled:
      true,
  });

if (
  !userOverride.capabilities
    .executive_intelligence.granted ||
  userOverride.capabilities.exports
    .granted ||
  userOverride.capabilities
    .executive_intelligence.source !==
    "user"
) {
  throw new Error(
    "User overrides must take precedence over organization entitlements."
  );
}

const stateless =
  resolveEntitlements({
    userId: "user_test",
    userMetadata: {
      grants: [
        "knowledge_intelligence",
      ],
    },
    knowledgePersistenceEnabled:
      false,
  });

if (
  stateless.capabilities
    .knowledge_intelligence.granted ||
  stateless.capabilities
    .knowledge_intelligence.source !==
    "system"
) {
  throw new Error(
    "Stateless mode must override Knowledge Intelligence grants."
  );
}

const admin = resolveEntitlements({
  userId: "admin_test",
  isAdmin: true,
  knowledgePersistenceEnabled:
    true,
});

if (
  Object.values(
    admin.capabilities
  ).some(
    (capability) =>
      !capability.granted
  )
) {
  throw new Error(
    "Administrators must receive all enabled deployment capabilities."
  );
}

console.log(
  JSON.stringify(
    {
      organizationGranted:
        organizationGrant.granted,
      userOverrideGranted:
        userOverride.granted,
      statelessKnowledge:
        stateless.capabilities
          .knowledge_intelligence,
      adminGranted:
        admin.granted,
    },
    null,
    2
  )
);
