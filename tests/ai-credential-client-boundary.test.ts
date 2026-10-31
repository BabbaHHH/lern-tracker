import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { AiCredentialClientBoundary, sameAiCredentialContext } from "../src/lib/ai-credentials/client-boundary";
import type { AiCredentialActorContext } from "../src/lib/ai-credentials/contract";
import { credentialRequestFingerprint, type CredentialSecrets } from "../src/lib/server/ai-credentials/crypto";

test("credential client boundary discards stale reads and detects account or login changes", () => {
  const boundary = new AiCredentialClientBoundary();
  const accountA: AiCredentialActorContext = { accountId: "member-a", accessGeneration: 2, sessionContext: "a".repeat(64) };
  const accountANewSession: AiCredentialActorContext = { ...accountA, sessionContext: "b".repeat(64) };
  const accountB: AiCredentialActorContext = { accountId: "member-b", accessGeneration: 1, sessionContext: "c".repeat(64) };

  const firstRead = boundary.begin();
  const secondRead = boundary.begin();
  assert.equal(boundary.accept(firstRead, accountA), "stale");
  assert.equal(boundary.accept(secondRead, accountA), "accepted");
  assert.equal(sameAiCredentialContext(boundary.context(), accountA), true);

  const afterRelogin = boundary.begin();
  assert.equal(boundary.accept(afterRelogin, accountANewSession), "changed");
  const afterAccountSwitch = boundary.begin();
  assert.equal(boundary.accept(afterAccountSwitch, accountB), "changed");
  boundary.reset();
  assert.equal(boundary.context(), null);
  assert.equal(boundary.isCurrent(afterAccountSwitch), false);
});

test("credential request proof changes with key input without exposing the input", () => {
  const secrets: CredentialSecrets = { encryptionKey: randomBytes(32), fingerprintKey: randomBytes(32) };
  const action = { action: "set-own", target: "member-a", source: "own", expectedRevision: null };
  const keyA = "synthetic-openrouter-key-A";
  const keyB = "synthetic-openrouter-key-B";
  const proofA = credentialRequestFingerprint(action, keyA, secrets);

  assert.match(proofA, /^[0-9a-f]{64}$/);
  assert.equal(credentialRequestFingerprint(action, keyA, secrets), proofA);
  assert.notEqual(credentialRequestFingerprint(action, keyB, secrets), proofA);
  assert.notEqual(credentialRequestFingerprint({ ...action, target: "member-b" }, keyA, secrets), proofA);
  assert.equal(proofA.includes(keyA), false);
});
