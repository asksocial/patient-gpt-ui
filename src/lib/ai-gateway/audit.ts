import type {
  AiAuditEvent,
  AiAuditSink,
} from "./types";

export class InMemoryAiAuditSink
  implements AiAuditSink
{
  private readonly events:
    AiAuditEvent[] = [];

  record(event: AiAuditEvent) {
    this.events.push(
      Object.freeze({
        ...event,
        toolIds: Object.freeze([
          ...event.toolIds,
        ]),
        moduleIds: Object.freeze([
          ...event.moduleIds,
        ]),
        usage: event.usage
          ? Object.freeze({
              ...event.usage,
            })
          : undefined,
      })
    );
  }

  list(): readonly AiAuditEvent[] {
    return Object.freeze([
      ...this.events,
    ]);
  }
}

export class ConsoleAiAuditSink
  implements AiAuditSink
{
  record(event: AiAuditEvent) {
    console.info(
      "[ai-gateway:audit]",
      JSON.stringify(event)
    );
  }
}
