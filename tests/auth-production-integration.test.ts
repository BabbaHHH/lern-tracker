import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { test } from "node:test";

test("AUTH03: isolierter Produktionsvertrag mit echter Loopback-DB und privaten Testdateien", { timeout: 90000 }, async t => {
  const before = createHash("sha256").update(JSON.stringify(process.env)).digest("hex");
  const child = fork(resolve("scripts/auth/production-integration-worker.ts"), [], {
    execArgv: ["--import", "tsx"], stdio: ["ignore", "ignore", "ignore", "ipc"],
    // No inherited DB/keys/provider settings or dotenv loader; only OS runtime paths.
    env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, LANG: "C", NODE_ENV: "test" },
  });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM"); });
  const messages: Array<{ count?: number; passed?: string[]; failedStage?: string; cleanup?: boolean; rootRemoved?: boolean; portClosed?: boolean }> = [];
  child.on("message", message => {
    messages.push(message as typeof messages[number]);
    if ((message as { boundary?: string }).boundary) console.log(`Verified boundary: ${(message as { boundary: string }).boundary}`);
    if ((message as { failureInfo?: object }).failureInfo) console.log("Sanitized test failure:", (message as { failureInfo: object }).failureInfo);
  });
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject); child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  assert.equal(createHash("sha256").update(JSON.stringify(process.env)).digest("hex"), before);
  assert.ok(messages.some(message => message.rootRemoved && message.portClosed && message.cleanup), "Own cluster, temporary files and loopback port cleaned");
  const failure = messages.find(message => message.failedStage);
  assert.equal(result.code, 0, `Isolated stage: ${failure?.failedStage ?? "process-start"}`); assert.equal(result.signal, null);
  const complete = messages.find(message => message.count); assert.equal(complete?.count, 10); assert.equal(complete?.cleanup, true);
  for (const name of complete!.passed!) console.log(`Verified integration boundary: ${name}`);
});
