import { createHmac, timingSafeEqual } from "node:crypto";

import { AcquisitionStoreError } from "./orchestrator";
import { validProviderId } from "./provider";

export type CompletionEvent = { planId: string; workspace: string; runId: string; eventId: string };

// The trusted relay signs the raw event. Apify's webhook dispatch ID alone
// is not an authentication mechanism.
export function verifyAcquisitionCallback(input: {
  body: Buffer;
  signature: string;
  timestamp: string;
  secret: string;
  now?: number;
}): CompletionEvent {
  const reject = () => new AcquisitionStoreError(403);
  if (Buffer.byteLength(input.secret) < 32 || input.body.length > 4096 ||
    !/^\d{10}$/.test(input.timestamp) || !/^sha256=[a-f0-9]{64}$/.test(input.signature)) throw reject();
  if (Math.abs((input.now ?? Date.now()) / 1000 - Number(input.timestamp)) > 300) throw reject();
  const expected = createHmac("sha256", input.secret).update(input.timestamp + ".").update(input.body).digest();
  if (!timingSafeEqual(expected, Buffer.from(input.signature.slice(7), "hex"))) throw reject();
  let event: CompletionEvent & { kind: string };
  try {
    event = JSON.parse(input.body.toString("utf8"));
  } catch {
    throw reject();
  }
  const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  if (!event || event.kind !== "run.completed" || typeof event.planId !== "string" ||
    typeof event.workspace !== "string" || !uuid.test(event.planId) || !uuid.test(event.workspace) ||
    !validProviderId(event.runId) || !validProviderId(event.eventId)) throw reject();
  return { planId: event.planId, workspace: event.workspace, runId: event.runId, eventId: event.eventId };
}
