import { getCurrentEntitlements } from "../entitlements/server";

export async function getChatAccess(write = false) {
  const entitlements = await getCurrentEntitlements();
  if (!entitlements) return null;
  if (write && entitlements.accountRole === "viewer") {
    throw Object.assign(new Error("Read-only accounts cannot change conversations."), { status: 403 });
  }
  return { ...entitlements, chatOrganizationId: entitlements.topicScope ? entitlements.organizationId : undefined };
}

export function restrictChatQuery<T>(query: T, access: NonNullable<Awaited<ReturnType<typeof getChatAccess>>>): T {
  // PostgREST filters operate on the same query builder.
  const filters = query as {
    eq(column: string, value: string): void;
    is(column: string, value: null): void;
    in(column: string, values: readonly string[]): void;
  };
  filters.eq("user_id", access.userId);
  if (access.chatOrganizationId) {
    filters.eq("organization_id", access.chatOrganizationId);
    filters.in("therapeutic_area", access.topicScope || []);
  } else {
    filters.is("organization_id", null);
  }
  return query;
}
