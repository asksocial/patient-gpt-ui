export type KnowledgePersistenceMode =
  | "stateless"
  | "persistent";

export function getKnowledgePersistenceMode(): KnowledgePersistenceMode {
  return process.env
    .ASKSOCIAL_KNOWLEDGE_MODE ===
    "persistent"
    ? "persistent"
    : "stateless";
}

export function getKnowledgePersistenceStatus() {
  const mode =
    getKnowledgePersistenceMode();

  return {
    mode,
    enabled: mode === "persistent",
    persisted: false,
  } as const;
}

export function knowledgePersistenceDisabledResponse() {
  return {
    ok: false,
    code:
      "KNOWLEDGE_PERSISTENCE_DISABLED",
    error:
      "Knowledge persistence is disabled for this deployment.",
    knowledgePersistence:
      getKnowledgePersistenceStatus(),
  };
}
