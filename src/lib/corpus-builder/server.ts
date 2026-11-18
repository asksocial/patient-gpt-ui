import "server-only";

import { isAdmin } from "../auth/isAdmin";
import { getSessionAccess } from "../auth/provisioning/session";
import { getSupabaseServerClient } from "../supabase/server";
import { createCorpusBuilderService } from "./service";

export const executeCorpusBuilder = createCorpusBuilderService({
  enabled: () => process.env.ASKSOCIAL_CORPUS_BUILDER_ENABLED === "true",
  async session() {
    const access = await getSessionAccess();
    if (!access) return null;
    const active = access.access === "allowed" && access.account?.state === "active";
    return {
      userId: access.user.id,
      principalId: access.session.orgId || access.user.id,
      active,
      administrator: active && await isAdmin(),
    };
  },
  async rpc(name, args) {
    return getSupabaseServerClient().rpc(name, args);
  },
});
