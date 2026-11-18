import assert from "node:assert/strict";

import { CorpusBuilderError, createCorpusBuilderService } from "../lib/corpus-builder/service";

async function main() {
  const workspace = "31000000-0000-4000-8000-000000000001";
  const protocol = "31000000-0000-4000-8000-000000000002";
  const admin = { userId: "synthetic-admin", principalId: "synthetic-org", active: true, administrator: true };
  let enabled = false;
  let session: typeof admin | null = admin;
  let rpcError: { code: string } | null = null;
  const requests: { name: string; args: Record<string, unknown> }[] = [];
  let sessionCalls = 0;
  const execute = createCorpusBuilderService({
    enabled: () => enabled,
    async session() { sessionCalls++; return session; },
    async rpc(name, args) {
      requests.push({ name, args });
      return { data: { protocol_id: protocol }, error: rpcError };
    },
  });
  const denied = (status: number) => (error: unknown) => error instanceof CorpusBuilderError && error.status === status;
  const status = () => execute(workspace, "status", { p_protocol: protocol });

  await assert.rejects(status, denied(404));
  assert.equal(sessionCalls, 0);
  enabled = true;
  session = null;
  await assert.rejects(status, denied(401));
  session = { ...admin, administrator: false };
  await assert.rejects(status, denied(403));
  session = { ...admin, active: false };
  await assert.rejects(status, denied(403));
  session = admin;
  await assert.rejects(() => execute("invalid", "status", { p_protocol: protocol }), denied(400));
  assert.deepEqual(requests, []);

  const inputs = { p_protocol: protocol, p_actor: "other", p_principal: "foreign", p_workspace: protocol };
  assert.equal((await execute(workspace, "status", inputs)).protocol_id, protocol);
  assert.deepEqual(requests, [{
    name: "corpus_builder_status",
    args: { p_protocol: protocol, p_actor: admin.userId, p_principal: admin.principalId, p_workspace: workspace },
  }]);
  for (const [code, expected] of [["42501", 403], ["22023", 400], ["23514", 400], ["P0001", 409], ["XX000", 503]] as const) {
    rpcError = { code };
    await assert.rejects(status, denied(expected));
  }
  console.log("PASS Corpus Builder disabled flag, application authorization, identity binding, and safe errors");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
