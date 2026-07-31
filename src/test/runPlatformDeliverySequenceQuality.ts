import {
  CAPABILITY_OWNERSHIP,
  getNextPlatformDeliveryMilestone,
  PLATFORM_DELIVERY_SEQUENCE,
} from "../lib/intelligence-platform";

if (
  PLATFORM_DELIVERY_SEQUENCE
    .length !== 14 ||
  PLATFORM_DELIVERY_SEQUENCE[0]
    .id !==
    "formalize_schemas" ||
  PLATFORM_DELIVERY_SEQUENCE.at(-1)
    ?.id !==
    "commercial_entitlements"
) {
  throw new Error(
    "The practical release sequence must preserve the prescribed roadmap order."
  );
}

const next =
  getNextPlatformDeliveryMilestone(
    PLATFORM_DELIVERY_SEQUENCE.slice(
      0,
      5
    ).map(
      (milestone) =>
        milestone.id
    )
  );

if (
  next?.id !==
  "medical_affairs_module"
) {
  throw new Error(
    "Delivery milestones must advance sequentially."
  );
}

const sharedCapabilities = [
  "security",
  "search",
  "reporting",
  "ai_gateway",
];
if (
  !sharedCapabilities.every(
    (capability) =>
      CAPABILITY_OWNERSHIP
        .platform.includes(
          capability as never
        ) &&
      !CAPABILITY_OWNERSHIP
        .module.includes(
          capability as never
        ) &&
      !CAPABILITY_OWNERSHIP
        .agent.includes(
          capability as never
        )
  )
) {
  throw new Error(
    "Security, search, reporting, and core AI infrastructure must remain platform-owned."
  );
}

console.log(
  JSON.stringify(
    {
      milestones:
        PLATFORM_DELIVERY_SEQUENCE.map(
          (milestone) =>
            milestone.id
        ),
      nextMilestone: next,
      capabilityOwnership:
        CAPABILITY_OWNERSHIP,
    },
    null,
    2
  )
);
