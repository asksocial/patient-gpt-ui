import "server-only";

import { getSupabaseServerClient } from "../../supabase/server";
import { createAcquisitionService } from "./service";
import type { AcquisitionProvider } from "./provider";

/** Gate 2A has no default Actor, transport, public callback, or scheduler. */
export function corpusAcquisitionFor(
  providers: readonly AcquisitionProvider[],
  session: Parameters<typeof createAcquisitionService>[0]["session"],
) {
  return createAcquisitionService({
    providers,
    enabled: () => process.env.ASKSOCIAL_CORPUS_BUILDER_ENABLED === "true" &&
      process.env.ASKSOCIAL_ACQUISITION_CONNECTOR_ENABLED === "true",
    session,
    async rpc(name, args) {
      return getSupabaseServerClient().rpc(name, args);
    },
  });
}
