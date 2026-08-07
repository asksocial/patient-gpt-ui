type PostgrestErrorLike = {
  code?: unknown;
  message?: unknown;
};

export function isMissingSessionWorkspaceColumn(
  error: unknown
) {
  const candidate =
    error && typeof error === "object"
      ? (error as PostgrestErrorLike)
      : {};
  const message =
    typeof candidate.message ===
    "string"
      ? candidate.message
          .toLowerCase()
      : "";

  return (
    candidate.code === "PGRST204" ||
    candidate.code === "42703" ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  ) &&
    message.includes("workspace_id") &&
    message.includes("chat_sessions");
}

export function addLegacyWorkspaceField<
  T extends Record<string, unknown>,
>(session: T) {
  return {
    workspace_id: null,
    ...session,
  };
}
