import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type CredentialSource = "pilot" | "own";
export interface CredentialSecrets {
  encryptionKey: Buffer;
  fingerprintKey: Buffer;
}
export interface CredentialCipherIdentity {
  credentialId: string;
  ownerUserId: string;
  source: CredentialSource;
}

export function credentialSecretsFromEnvironment(): CredentialSecrets {
  const encryption = process.env.STEX_AI_CREDENTIAL_ENCRYPTION_KEY ?? "";
  const fingerprint = process.env.STEX_AI_CREDENTIAL_FINGERPRINT_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(encryption) || !/^[0-9a-fA-F]{64}$/.test(fingerprint)
    || encryption.toLowerCase() === fingerprint.toLowerCase()) {
    throw new Error("Sichere KI-Schlüsselverwaltung ist in dieser Umgebung nicht eingerichtet.");
  }
  return { encryptionKey: Buffer.from(encryption, "hex"), fingerprintKey: Buffer.from(fingerprint, "hex") };
}

function aad(identity: CredentialCipherIdentity): Buffer {
  return Buffer.from(`stex-ai-credential-v1\0${identity.credentialId}\0${identity.ownerUserId}\0${identity.source}`, "utf8");
}

export function encryptCredential(value: string, identity: CredentialCipherIdentity, secrets: CredentialSecrets): string {
  if (!value || secrets.encryptionKey.length !== 32) throw new Error("KI-Zugang kann nicht sicher gespeichert werden.");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secrets.encryptionKey, nonce);
  cipher.setAAD(aad(identity));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptCredential(value: string, identity: CredentialCipherIdentity, secrets: CredentialSecrets): string {
  try {
    const [version, nonceText, tagText, ciphertextText, extra] = value.split(".");
    if (version !== "v1" || !nonceText || !tagText || !ciphertextText || extra
      || secrets.encryptionKey.length !== 32 || secrets.fingerprintKey.length !== 32) throw new Error();
    const nonce = Buffer.from(nonceText, "base64url");
    const tag = Buffer.from(tagText, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", secrets.encryptionKey, nonce);
    decipher.setAAD(aad(identity));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Der gespeicherte KI-Zugang kann nicht sicher entschlüsselt werden.");
  }
}

export function credentialFingerprint(value: string, secrets: CredentialSecrets): string {
  if (secrets.fingerprintKey.length !== 32) throw new Error("KI-Fingerabdruckschlüssel ist ungültig.");
  return createHmac("sha256", secrets.fingerprintKey).update(value, "utf8").digest("hex");
}

/**
 * Purpose-separated proof for audit replay matching. It binds the complete action and
 * input, including a submitted key, without persisting that key or its duplicate-detection
 * fingerprint. The derived HMAC key is distinct from credentialFingerprint's output.
 */
export function credentialRequestFingerprint(
  semanticInput: unknown,
  apiKey: string | null,
  secrets: CredentialSecrets,
): string {
  if (secrets.fingerprintKey.length !== 32) throw new Error("KI-Fingerabdruckschlüssel ist ungültig.");
  const proofKey = createHmac("sha256", secrets.fingerprintKey).update("stex-ai-credential-request-proof-v1").digest();
  return createHmac("sha256", proofKey).update(JSON.stringify({ semanticInput, apiKey }), "utf8").digest("hex");
}

export function fingerprintMatches(value: string, expected: string, secrets: CredentialSecrets): boolean {
  if (!/^[0-9a-f]{64}$/.test(expected)) return false;
  const actual = Buffer.from(credentialFingerprint(value, secrets), "hex");
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

export function verifyCredentialCiphertext(
  encryptedKey: string,
  fingerprint: string,
  identity: CredentialCipherIdentity,
  secrets: CredentialSecrets,
): void {
  const value = decryptCredential(encryptedKey, identity, secrets);
  if (!fingerprintMatches(value, fingerprint, secrets)) throw new Error("Der gespeicherte KI-Zugang kann nicht sicher entschlüsselt werden.");
}
