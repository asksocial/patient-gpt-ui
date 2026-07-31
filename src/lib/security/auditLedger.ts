import {
  createHash,
} from "node:crypto";

export type SecurityAuditInput = {
  organizationId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome:
    | "allowed"
    | "denied"
    | "completed"
    | "failed";
  metadata?: Record<
    string,
    unknown
  >;
  occurredAt: string;
};

export type SecurityAuditEvent =
  Readonly<
    SecurityAuditInput & {
      sequence: number;
      previousHash: string;
      hash: string;
    }
  >;

function canonicalize(
  value: unknown
): string {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value
      .map(canonicalize)
      .join(",")}]`;
  }
  return `{${Object.entries(
    value as Record<
      string,
      unknown
    >
  )
    .sort(([left], [right]) =>
      left.localeCompare(right)
    )
    .map(
      ([key, item]) =>
        `${JSON.stringify(key)}:${canonicalize(item)}`
    )
    .join(",")}}`;
}

function hashEvent(
  event: Omit<
    SecurityAuditEvent,
    "hash"
  >
) {
  return createHash("sha256")
    .update(canonicalize(event))
    .digest("hex");
}

export class ImmutableAuditLedger {
  private readonly events:
    SecurityAuditEvent[] = [];

  append(
    input: SecurityAuditInput
  ): SecurityAuditEvent {
    const previous =
      this.events.at(-1);
    const eventWithoutHash = {
      ...input,
      metadata: {
        ...(input.metadata ||
          {}),
      },
      sequence:
        this.events.length + 1,
      previousHash:
        previous?.hash ||
        "GENESIS",
    };
    const event = Object.freeze({
      ...eventWithoutHash,
      metadata: Object.freeze({
        ...eventWithoutHash.metadata,
      }),
      hash: hashEvent(
        eventWithoutHash
      ),
    });
    this.events.push(event);
    return event;
  }

  list(): readonly SecurityAuditEvent[] {
    return Object.freeze([
      ...this.events,
    ]);
  }

  verify(
    events:
      readonly SecurityAuditEvent[] =
      this.events
  ) {
    return events.every(
      (event, index) => {
        const {
          hash,
          ...withoutHash
        } = event;
        const expectedPrevious =
          index === 0
            ? "GENESIS"
            : events[index - 1]
                .hash;
        return (
          event.previousHash ===
            expectedPrevious &&
          hashEvent(
            withoutHash
          ) === hash
        );
      }
    );
  }
}
