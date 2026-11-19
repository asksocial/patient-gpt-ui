import { normalizeTherapeuticAreaId } from "../analytics/coverage";

// Undefined preserves the legacy service path. An empty set permits no topics.
export function permitsTopic(topicScope: readonly string[] | undefined, topic: unknown) {
  if (!topicScope) return true;
  if (typeof topic !== "string" || !topic.trim()) return false;
  return topicScope.some(grant => normalizeTherapeuticAreaId(grant) === normalizeTherapeuticAreaId(topic));
}

export function assertTopicScope(topicScope: readonly string[] | undefined, topic: unknown) {
  if (!permitsTopic(topicScope, topic)) {
    throw Object.assign(new Error("Topic access is required."), { status: 403 });
  }
}
