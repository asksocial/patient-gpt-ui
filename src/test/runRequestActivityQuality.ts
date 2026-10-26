import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { activityFetch, beginActivity, getPendingActivity, subscribeToActivity, withActivity } from "../lib/client/requestActivity";
import { downloadFile, getDownloadFileName } from "../lib/client/downloadFile";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function run() {
  const nativeFetch = globalThis.fetch;
  const snapshots: number[] = [];
  const unsubscribe = subscribeToActivity(() => snapshots.push(getPendingActivity()));
  try {
    const finishFirst = beginActivity();
    const finishSecond = beginActivity();
    assert.equal(getPendingActivity(), 2);
    finishFirst(); finishFirst();
    assert.equal(getPendingActivity(), 1, "Cleanup is idempotent and leaves overlapping work visible.");
    finishSecond();
    assert.equal(getPendingActivity(), 0);

    const first = deferred<Response>();
    const second = deferred<Response>();
    globalThis.fetch = (input) => String(input).endsWith("first") ? first.promise : second.promise;
    const a = activityFetch("/first");
    const b = activityFetch("/second");
    assert.equal(getPendingActivity(), 2);
    first.resolve(Response.json({ ok: true }));
    assert.deepEqual(await (await a).json(), { ok: true }, "The caller's response remains readable.");
    assert.equal(getPendingActivity(), 1);
    second.resolve(new Response(null, { status: 204 }));
    assert.equal((await b).status, 204);
    assert.equal(getPendingActivity(), 0);

    let body!: ReadableStreamDefaultController<Uint8Array>;
    const response = new Response(new ReadableStream<Uint8Array>({ start(controller) { body = controller; } }));
    globalThis.fetch = async () => response;
    let resolved = false;
    const transfer = activityFetch("/slow-body").then(value => { resolved = true; return value; });
    await tick();
    body.enqueue(new TextEncoder().encode('{"done":'));
    await tick();
    assert.equal(resolved, false, "Receiving headers and partial bytes must not finish loading.");
    assert.equal(getPendingActivity(), 1);
    body.enqueue(new TextEncoder().encode("true}")); body.close();
    assert.deepEqual(await (await transfer).json(), { done: true });
    assert.equal(getPendingActivity(), 0);

    globalThis.fetch = async () => { throw new TypeError("Network unavailable"); };
    await assert.rejects(activityFetch("/failure"), /Network unavailable/);
    assert.equal(getPendingActivity(), 0);
    globalThis.fetch = async () => Response.json({ error: "Forbidden" }, { status: 403 });
    const forbidden = await activityFetch("/forbidden");
    assert.equal(forbidden.status, 403);
    assert.deepEqual(await forbidden.json(), { error: "Forbidden" });
    await assert.rejects(downloadFile("/forbidden"), /Forbidden/);
    assert.equal(getPendingActivity(), 0, "HTTP and download errors leave no pending activity.");

    const controller = new AbortController();
    globalThis.fetch = (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
    const aborted = assert.rejects(activityFetch("/abort", { signal: controller.signal }), { name: "AbortError" });
    controller.abort(); await aborted;
    assert.equal(getPendingActivity(), 0);

    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
    const link = { href: "", download: "", clicked: false, removed: false, click() { this.clicked = true; }, remove() { this.removed = true; } };
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => link, body: { appendChild() {} } } });
    try {
      globalThis.fetch = async () => new Response("record,evidence\n1,example", { headers: { "Content-Disposition": 'attachment; filename="review.csv"', "Content-Type": "text/csv" } });
      await downloadFile("/export");
      assert.equal(link.download, "review.csv");
      assert.ok(link.href.startsWith("blob:") && link.clicked && link.removed, "Downloads retain their server filename and release their temporary link.");
      assert.equal(getPendingActivity(), 0);
    } finally {
      if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
      else delete (globalThis as { document?: unknown }).document;
    }

    let brokenBody!: ReadableStreamDefaultController;
    globalThis.fetch = async () => new Response(new ReadableStream({ start(value) { brokenBody = value; } }));
    const broken = assert.rejects(activityFetch("/broken-transfer"), /Transfer interrupted/);
    await tick(); brokenBody.error(new Error("Transfer interrupted")); await broken;
    assert.equal(getPendingActivity(), 0);

    await assert.rejects(withActivity(async () => { throw new Error("Action failed"); }), /Action failed/);
    assert.equal(getPendingActivity(), 0, "Multi-step action failures also clean up.");
    assert.equal(getDownloadFileName('attachment; filename="review.csv"'), "review.csv");
    assert.equal(getDownloadFileName("attachment; filename*=UTF-8''review%20list.csv"), "review list.csv");
    assert.equal(getDownloadFileName("attachment; filename*=UTF-8''%broken; filename=backup.csv"), "backup.csv");
    assert.equal(getDownloadFileName('attachment; filename="../review.csv"'), ".._review.csv");

    let trackedFiles = 0;
    function inspect(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) { inspect(path); continue; }
        if (!/\.(jsx|tsx|js)$/.test(path)) continue;
        const source = readFileSync(path, "utf8");
        if (!source.startsWith('"use client";') || !/\bfetch\(/.test(source)) continue;
        assert.match(source, /import \{ activityFetch as fetch \} from /, `${relative(process.cwd(), path)} must track its client data requests.`);
        trackedFiles += 1;
      }
    }
    inspect(join(process.cwd(), "src/components")); inspect(join(process.cwd(), "src/app"));
    assert.ok(trackedFiles > 0, "The client request coverage audit must inspect data-fetching screens.");
    assert.match(readFileSync("src/app/layout.js", "utf8"), /<AppActivityIndicator \/>/);
    assert.match(readFileSync("src/app/loading.jsx", "utf8"), /<ActivityNotice/);
    assert.ok(snapshots.includes(2) && snapshots.at(-1) === 0);
    console.log(`PASS shared loading: ${trackedFiles} client screens, concurrent requests, full body transfer, success, errors, aborts, downloads, and route fallback`);
  } finally {
    globalThis.fetch = nativeFetch;
    unsubscribe();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
