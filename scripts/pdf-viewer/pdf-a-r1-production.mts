/** Production guard smoke test. No database, real account or credential is used. */
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { open, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const snapshot = resolve(process.argv[2]), proof = resolve(process.argv[3]);
if (!snapshot.includes("stex-pdf-a-r1-") || !proof.includes("pdf-a-r1-")) throw new Error("Expected isolated paths");
const listener = createServer(); await new Promise<void>(done => listener.listen(0, "127.0.0.1", done));
const address = listener.address(); if (!address || typeof address === "string") throw new Error("Missing port");
const port = address.port; await new Promise<void>(done => listener.close(() => done()));
const base = `http://localhost:${port}`, log = await open(proof + ".server.log", "w");
const child = spawn(process.execPath, [join(snapshot, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: snapshot, env: { PATH: process.env.PATH, NODE_ENV: "production", STEX_AUTH_MODE: "local", BETTER_AUTH_URL: base }, stdio: ["ignore", log.fd, log.fd],
});
await log.close();
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { await fetch(`${base}/api/catalog/pdf`); ready = true; break; } catch { await new Promise(done => setTimeout(done, 100)); }
  }
  assert.ok(ready, "Production server did not start");
  const results = [];
  for (const method of ["GET", "HEAD"]) {
    const response = await fetch(`${base}/api/catalog/pdf?klausurId=synthetic&documentId=synthetic&documentVersionId=synthetic`, { method, headers: { Range: "bytes=0-7", "If-None-Match": "*", "If-Range": '"unknown"' } });
    assert.equal(response.status, 503); assert.equal(response.headers.has("content-range"), false);
    assert.match(response.headers.get("cache-control")!, /private.*no-store/);
    const body = await response.text(); if (method === "HEAD") assert.equal(body, "");
    else assert.equal(JSON.parse(body).error.code, "unavailable");
    results.push({ method, status: response.status, cache: response.headers.get("cache-control"), metadata: false, bodyBytes: body.length });
  }
  await writeFile(proof, JSON.stringify({ results, childStoppedInFinally: true }, null, 2));
  console.log("Production GET/HEAD remain closed (503), without metadata or HEAD body.");
} finally {
  if (child.exitCode === null) { const exited = once(child, "exit"); child.kill("SIGTERM"); await exited; }
}
