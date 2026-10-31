import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { digest } from "../../data-migration/migration";
import { AccountService, type Principal } from "../auth/service";
import { AccountError, atomicLimit } from "../auth/security";
import { lockState } from "../persistence/repository";
import type { AiCredentialActorContext, AiCredentialRequestOptions, AiCredentialTargetContext } from "../../ai-credentials/contract";
import {
  credentialFingerprint,
  credentialRequestFingerprint,
  decryptCredential,
  encryptCredential,
  fingerprintMatches,
  type CredentialCipherIdentity,
  type CredentialSecrets,
  type CredentialSource,
  verifyCredentialCiphertext,
} from "./crypto";
import {
  getOpenRouterKeyStatus,
  OpenRouterCredentialError,
  validatePilotLimit,
  type OpenRouterKeyStatus,
} from "./openrouter";

type SelectedSource = CredentialSource | "off";
interface SelectionRow { selected_source: SelectedSource; revision: number }
interface CredentialRow {
  credential_id: string;
  owner_user_id: string;
  source: CredentialSource;
  encrypted_key: string | null;
  key_fingerprint: string | null;
  key_suffix: string | null;
  configured: boolean;
  revision: number;
}
export interface AiCredentialAccess {
  userId: string;
  sessionId: string;
  generation: number;
  source: CredentialSource;
  credentialId: string;
  credentialRevision: number;
  selectionRevision: number;
  apiKey: string;
}
export class AiCredentialError extends AccountError {}

function actorContext(who: Pick<Principal, "userId" | "generation" | "sessionId">): AiCredentialActorContext {
  return { accountId: who.userId, accessGeneration: who.generation, sessionContext: digest(["learning-session", who.sessionId]) };
}
function targetContext(accountId: string, accessGeneration: number): AiCredentialTargetContext {
  return { accountId, accessGeneration };
}
function sameActorContext(expected: AiCredentialActorContext, current: AiCredentialActorContext): boolean {
  return expected.accountId === current.accountId && expected.accessGeneration === current.accessGeneration
    && expected.sessionContext === current.sessionContext;
}
function assertActorContext(expected: AiCredentialActorContext, current: AiCredentialActorContext): void {
  if (!sameActorContext(expected, current)) {
    throw new AiCredentialError("account_changed", "Das Konto oder die Anmeldung hat sich geändert. Bitte neu laden.", 409);
  }
}

const missingPilot = "Dein KI-Startzugang ist noch nicht eingerichtet. Bitte wende dich an die Kontoverwaltung.";
const missingOwn = "Füge unter /konto/ki deinen eigenen OpenRouter-Schlüssel ein und wähle ihn ausdrücklich aus.";
const conflict = (message: string) => new AiCredentialError("conflict", message, 409);

export class AiCredentialService {
  constructor(
    readonly auth: AccountService,
    readonly secrets: CredentialSecrets,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private identity(row: Pick<CredentialRow, "credential_id" | "owner_user_id" | "source">): CredentialCipherIdentity {
    return { credentialId: row.credential_id, ownerUserId: row.owner_user_id, source: row.source };
  }

  private async assertFreshPrincipal(
    headers: Headers,
    level: "active" | "admin",
    expected: AiCredentialActorContext,
  ): Promise<Principal> {
    const who = await this.auth.principal(headers, level, true);
    assertActorContext(expected, actorContext(who));
    await this.auth.database.transaction(async client => {
      await lockState(client);
      const current = await this.auth.checkPrincipal(client, who.sessionId, level, true, true);
      if (current.userId !== who.userId || current.generation !== who.generation) {
        throw new AiCredentialError("session_changed", "Deine Kontositzung hat sich geändert. Bitte neu laden.", 409);
      }
      assertActorContext(expected, actorContext(current));
    });
    return who;
  }

  private async takeWriteLimit(client: PoolClient, userId: string, action: string): Promise<void> {
    await atomicLimit(client, `ai-credential:${userId}:${action}`, 8, 900);
  }

  private async selection(client: PoolClient, ownerUserId: string): Promise<SelectionRow> {
    const row = (await client.query<SelectionRow>(
      "SELECT selected_source,revision FROM stex.ai_credential_selections WHERE owner_user_id=$1 FOR UPDATE",
      [ownerUserId],
    )).rows[0];
    return row ?? { selected_source: "off", revision: 0 };
  }

  private async credential(client: PoolClient, ownerUserId: string, source: CredentialSource): Promise<CredentialRow | null> {
    return (await client.query<CredentialRow>(
      "SELECT credential_id,owner_user_id,source,encrypted_key,key_fingerprint,key_suffix,configured,revision FROM stex.ai_credentials WHERE owner_user_id=$1 AND source=$2 FOR UPDATE",
      [ownerUserId, source],
    )).rows[0] ?? null;
  }

  private safeKey(row: CredentialRow): string {
    if (!row.configured || !row.encrypted_key || !row.key_fingerprint) {
      throw new AiCredentialError("credential_missing", row.source === "pilot" ? missingPilot : missingOwn, 409);
    }
    const value = decryptCredential(row.encrypted_key, this.identity(row), this.secrets);
    if (!fingerprintMatches(value, row.key_fingerprint, this.secrets)) {
      throw new AiCredentialError("credential_unavailable", "Der gespeicherte KI-Zugang kann nicht sicher gelesen werden.", 503);
    }
    return value;
  }

  private async readOwner(headers: Headers, fresh = false): Promise<{
    principal: Principal;
    selection: SelectionRow;
    credentials: Partial<Record<CredentialSource, CredentialRow>>;
  }> {
    const principal = await this.auth.principal(headers, "active", fresh);
    return this.auth.database.transaction(async client => {
      await lockState(client);
      const current = await this.auth.checkPrincipal(client, principal.sessionId, "active", fresh, true);
      if (current.userId !== principal.userId || current.generation !== principal.generation) {
        throw new AiCredentialError("session_changed", "Deine Kontositzung hat sich geändert. Bitte neu laden.", 409);
      }
      const selected = await this.selection(client, current.userId);
      const rows = await client.query<CredentialRow>(
        "SELECT credential_id,owner_user_id,source,encrypted_key,key_fingerprint,key_suffix,configured,revision FROM stex.ai_credentials WHERE owner_user_id=$1 ORDER BY source",
        [current.userId],
      );
      const credentials: Partial<Record<CredentialSource, CredentialRow>> = {};
      for (const row of rows.rows) credentials[row.source] = row;
      return { principal: current, selection: selected, credentials };
    });
  }

  async ownerContext(headers: Headers): Promise<Record<string, unknown>> {
    const principal = await this.auth.principal(headers, "active", true);
    return this.auth.database.transaction(async client => {
      await lockState(client);
      const current = await this.auth.checkPrincipal(client, principal.sessionId, "active", true, true);
      if (current.userId !== principal.userId || current.generation !== principal.generation) {
        throw new AiCredentialError("session_changed", "Deine Kontositzung hat sich geändert. Bitte neu laden.", 409);
      }
      return { contractVersion: 2, context: actorContext(current) };
    });
  }

  async resolveSelected(headers: Headers): Promise<AiCredentialAccess> {
    const snapshot = await this.readOwner(headers);
    if (snapshot.selection.selected_source === "off") {
      throw new AiCredentialError("ai_disabled", "Die KI ist ausgeschaltet. Wähle unter /konto/ki einen Zugang aus.", 409);
    }
    const source = snapshot.selection.selected_source;
    const row = snapshot.credentials[source];
    if (!row) throw new AiCredentialError("credential_missing", source === "pilot" ? missingPilot : missingOwn, 409);
    const apiKey = this.safeKey(row);
    return {
      userId: snapshot.principal.userId,
      sessionId: snapshot.principal.sessionId,
      generation: snapshot.principal.generation,
      source,
      credentialId: row.credential_id,
      credentialRevision: row.revision,
      selectionRevision: snapshot.selection.revision,
      apiKey,
    };
  }

  async assertAccessCurrent(access: AiCredentialAccess): Promise<void> {
    await this.auth.database.transaction(async client => {
      await lockState(client);
      const current = await this.auth.checkPrincipal(client, access.sessionId, "active", false, true);
      if (current.userId !== access.userId || current.generation !== access.generation) {
        throw new AiCredentialError("session_changed", "Deine Kontositzung hat sich geändert. Die KI-Antwort wurde verworfen.", 409);
      }
      const selected = await this.selection(client, current.userId);
      const credential = await this.credential(client, current.userId, access.source);
      if (selected.selected_source !== access.source || selected.revision !== access.selectionRevision
        || !credential?.configured || credential.revision !== access.credentialRevision || credential.credential_id !== access.credentialId) {
        throw new AiCredentialError("access_changed", "Der gewählte KI-Zugang hat sich während der Anfrage geändert. Bitte bewusst neu versuchen.", 409);
      }
    });
  }

  async ownerStatus(headers: Headers): Promise<Record<string, unknown>> {
    const snapshot = await this.readOwner(headers);
    await this.auth.database.transaction(async client => {
      await lockState(client);
      const current = await this.auth.checkPrincipal(client, snapshot.principal.sessionId, "active", false, true);
      if (current.userId !== snapshot.principal.userId || current.generation !== snapshot.principal.generation) {
        throw new AiCredentialError("session_changed", "Deine Kontositzung hat sich geändert. Bitte neu laden.", 409);
      }
      await atomicLimit(client, `ai-credential-status:${current.userId}`, 20, 60);
    });
    const credentials = {} as Record<CredentialSource, { configured: boolean; revision: number; maskedKey: string | null }>;
    for (const source of ["pilot", "own"] as const) {
      const row = snapshot.credentials[source];
      credentials[source] = {
        configured: !!row?.configured,
        revision: row?.revision ?? 0,
        maskedKey: row?.configured && row.key_suffix ? `••••${row.key_suffix}` : null,
      };
    }
    const result: Record<string, unknown> = {
      contractVersion: 2,
      context: actorContext(snapshot.principal),
      account: { userId: snapshot.principal.userId, status: snapshot.principal.status, role: snapshot.principal.role },
      selection: { source: snapshot.selection.selected_source, revision: snapshot.selection.revision },
      credentials,
      providerStatus: null,
    };
    if (snapshot.selection.selected_source === "off") return result;
    const row = snapshot.credentials[snapshot.selection.selected_source];
    if (!row) {
      result.providerStatus = { state: "missing", message: snapshot.selection.selected_source === "pilot" ? missingPilot : missingOwn };
      return result;
    }
    let apiKey: string;
    try { apiKey = this.safeKey(row); }
    catch {
      result.providerStatus = { state: "unavailable", message: "Der gespeicherte KI-Zugang ist nicht verfügbar. Bitte wende dich an die Kontoverwaltung." };
      return result;
    }
    let liveStatus: OpenRouterKeyStatus | null = null;
    let providerFailure: unknown;
    try { liveStatus = await getOpenRouterKeyStatus(apiKey, this.fetcher); }
    catch (error) { providerFailure = error; }
    await this.assertAccessCurrent({
      userId: snapshot.principal.userId, sessionId: snapshot.principal.sessionId, generation: snapshot.principal.generation,
      source: row.source, credentialId: row.credential_id, credentialRevision: row.revision,
      selectionRevision: snapshot.selection.revision, apiKey,
    });
    if (liveStatus) {
      result.providerStatus = { state: "ready", source: row.source, ...liveStatus };
    } else {
      const providerError = providerFailure instanceof OpenRouterCredentialError ? providerFailure : null;
      result.providerStatus = {
        state: providerError?.code === "provider_key_invalid" ? "invalid" : providerError?.code === "provider_busy" ? "busy" : "unavailable",
        message: providerError?.message ?? "Der OpenRouter-Status ist gerade nicht verfügbar.",
      };
    }
    return result;
  }

  private requestFingerprint(
    action: string,
    target: string,
    source: string,
    options: AiCredentialRequestOptions,
    apiKey: string | null,
  ): string {
    return credentialRequestFingerprint({
      action,
      target,
      source,
      expectedRevision: options.expectedRevision,
      expectedActorContext: options.expectedActorContext,
      expectedTargetContext: options.expectedTargetContext ?? null,
    }, apiKey, this.secrets);
  }

  private async assertTargetContext(
    client: PoolClient,
    targetUserId: string,
    expected: AiCredentialTargetContext | undefined,
    requireActive: boolean,
  ): Promise<void> {
    if (!expected || expected.accountId !== targetUserId) {
      throw new AiCredentialError("account_changed", "Das ausgewählte Mitglied hat sich geändert. Bitte neu laden.", 409);
    }
    const target = (await client.query<{ status: string; role: string; generation: number }>(
      `SELECT a.status,a.role,x.generation FROM stex.accounts a JOIN stex.account_access x ON x.user_id=a.user_id
       WHERE a.user_id=$1 FOR UPDATE OF a,x`,
      [targetUserId],
    )).rows[0];
    if (!target) throw new AiCredentialError("not_found", "Konto nicht gefunden.", 404);
    if (target.generation !== expected.accessGeneration) {
      throw new AiCredentialError("account_changed", "Das ausgewählte Mitglied oder dessen Zugang hat sich geändert. Bitte neu laden.", 409);
    }
    if (target.role !== "member" || (requireActive && target.status !== "active")) {
      throw new AiCredentialError("forbidden", requireActive
        ? "Ein Pilot-Schlüssel kann nur einem aktiven Mitglied zugeordnet werden."
        : "Ein Pilot-Schlüssel kann nur einem Mitglied zugeordnet werden.", 403);
    }
  }

  /** Validate actor, replay and displayed revision before any provider validation call. */
  private async preflightCredentialWrite(input: {
    actor: Principal;
    targetUserId: string;
    source: CredentialSource;
    apiKey: string;
    options: AiCredentialRequestOptions;
    admin: boolean;
  }): Promise<Record<string, unknown> | null> {
    const { actor, targetUserId, source, apiKey, options, admin } = input;
    const action = admin ? "ai-credential-pilot-set" : "ai-credential-own-set";
    const fingerprint = this.requestFingerprint(action, targetUserId, source, options, apiKey);
    return this.auth.database.transaction(async client => {
      await lockState(client);
      const current = await this.auth.checkPrincipal(client, actor.sessionId, admin ? "admin" : "active", true, true);
      if (current.userId !== actor.userId || current.generation !== actor.generation) {
        throw new AiCredentialError("session_changed", "Deine Kontositzung hat sich geändert. Bitte neu laden.", 409);
      }
      assertActorContext(options.expectedActorContext, actorContext(current));
      const previousRequest = await this.replay(client, actor.userId, options.requestId, fingerprint);
      if (previousRequest) return previousRequest as Record<string, unknown>;
      if (admin) await this.assertTargetContext(client, targetUserId, options.expectedTargetContext, true);
      else if (targetUserId !== current.userId) throw new AiCredentialError("forbidden", "Der eigene KI-Zugang gehört zu deinem Konto.", 403);
      const previous = await this.credential(client, targetUserId, source);
      if ((previous?.revision ?? null) !== options.expectedRevision) {
        throw conflict("Der KI-Zugang wurde inzwischen geändert. Bitte neu laden.");
      }
      return null;
    });
  }

  private async replay(client: PoolClient, actor: string, requestId: string, fingerprint: string): Promise<unknown | null> {
    const row = (await client.query<{ fingerprint: string; result: unknown }>(
      "SELECT fingerprint,result FROM stex.account_audit WHERE actor=$1 AND request_id=$2 FOR UPDATE",
      [actor, requestId],
    )).rows[0];
    if (!row) return null;
    if (row.fingerprint !== fingerprint) throw conflict("Diese Vorgangskennung wurde bereits für eine andere Aktion verwendet.");
    return { ...(row.result as Record<string, unknown>), replay: true };
  }

  private async record(client: PoolClient, actor: string, target: string, action: string, requestId: string, fingerprint: string, result: unknown): Promise<void> {
    await client.query(
      "INSERT INTO stex.account_audit(id,actor,target,action,request_id,fingerprint,result) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)",
      [randomUUID(), actor, target, action, requestId, fingerprint, JSON.stringify(result)],
    );
  }

  private async bump(client: PoolClient): Promise<void> {
    await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton");
  }

  private async validateKey(apiKey: string, source: CredentialSource): Promise<OpenRouterKeyStatus> {
    if (typeof apiKey !== "string" || apiKey.length < 20 || apiKey.length > 512 || /\s/.test(apiKey)) {
      throw new AiCredentialError("invalid_input", "Bitte einen gültigen OpenRouter-API-Schlüssel einfügen.");
    }
    try {
      const status = await getOpenRouterKeyStatus(apiKey, this.fetcher);
      if (source === "pilot") validatePilotLimit(status);
      return status;
    } catch (error) {
      if (error instanceof OpenRouterCredentialError) throw new AiCredentialError(error.code, error.message, error.status);
      throw error;
    }
  }

  private async writeCredential(input: {
    actor: Principal;
    targetUserId: string;
    source: CredentialSource;
    apiKey: string;
    options: AiCredentialRequestOptions;
    admin: boolean;
  }): Promise<Record<string, unknown>> {
    const { actor, targetUserId, source, apiKey, options, admin } = input;
    const action = admin ? "ai-credential-pilot-set" : "ai-credential-own-set";
    const fingerprint = this.requestFingerprint(action, targetUserId, source, options, apiKey);
    try {
      return await this.auth.database.transaction(async client => {
        await lockState(client);
        const currentActor = await this.auth.checkPrincipal(client, actor.sessionId, admin ? "admin" : "active", admin, true);
        if (currentActor.userId !== actor.userId || currentActor.generation !== actor.generation) {
          throw new AiCredentialError("session_changed", "Deine Kontositzung hat sich geändert. Bitte neu laden.", 409);
        }
        assertActorContext(options.expectedActorContext, actorContext(currentActor));
        const replay = await this.replay(client, actor.userId, options.requestId, fingerprint);
        if (replay) return replay as Record<string, unknown>;
        if (admin) {
          await this.assertTargetContext(client, targetUserId, options.expectedTargetContext, true);
        } else if (targetUserId !== actor.userId) {
          throw new AiCredentialError("forbidden", "Der eigene KI-Zugang gehört zu deinem Konto.", 403);
        }
        await this.takeWriteLimit(client, actor.userId, action);
        const previous = await this.credential(client, targetUserId, source);
        const currentRevision = previous?.revision ?? null;
        if (currentRevision !== options.expectedRevision) throw conflict("Der KI-Zugang wurde inzwischen geändert. Bitte neu laden.");
        const id = previous?.credential_id ?? randomUUID();
        const keyFingerprint = credentialFingerprint(apiKey, this.secrets);
        const duplicate = (await client.query<{ owner_user_id: string; source: CredentialSource; credential_id: string }>(
          "SELECT owner_user_id,source,credential_id FROM stex.ai_credentials WHERE key_fingerprint=$1",
          [keyFingerprint],
        )).rows[0];
        if (duplicate && (duplicate.owner_user_id !== targetUserId || duplicate.source !== source || duplicate.credential_id !== id)) {
          throw new AiCredentialError("key_already_assigned", "Dieser OpenRouter-Schlüssel ist bereits einem Konto zugeordnet.", 409);
        }
        const encrypted = encryptCredential(apiKey, { credentialId: id, ownerUserId: targetUserId, source }, this.secrets);
        const revision = (previous?.revision ?? 0) + 1;
        if (previous) {
          await client.query(`UPDATE stex.ai_credentials SET encrypted_key=$2,key_fingerprint=$3,key_suffix=$4,configured=true,
            revision=$5,updated_at=now(),updated_by_user_id=$6 WHERE credential_id=$1`,
          [id, encrypted, keyFingerprint, apiKey.slice(-4), revision, actor.userId]);
        } else {
          await client.query(`INSERT INTO stex.ai_credentials(credential_id,owner_user_id,source,encrypted_key,key_fingerprint,key_suffix,configured,revision,created_by_user_id,updated_by_user_id)
            VALUES($1,$2,$3,$4,$5,$6,true,1,$7,$7)`,
          [id, targetUserId, source, encrypted, keyFingerprint, apiKey.slice(-4), actor.userId]);
        }
        const result = { contractVersion: 2, ownerUserId: targetUserId, source, configured: true, revision, selected: false, replay: false };
        await this.record(client, actor.userId, targetUserId, action, options.requestId, fingerprint, result);
        await this.bump(client);
        return result;
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new AiCredentialError("key_already_assigned", "Dieser OpenRouter-Schlüssel ist bereits einem Konto zugeordnet.", 409);
      }
      throw error;
    }
  }

  async setOwn(headers: Headers, apiKey: string, options: AiCredentialRequestOptions): Promise<Record<string, unknown>> {
    const actor = await this.assertFreshPrincipal(headers, "active", options.expectedActorContext);
    const replay = await this.preflightCredentialWrite({ actor, targetUserId: actor.userId, source: "own", apiKey, options, admin: false });
    if (replay) return replay;
    await this.validateKey(apiKey, "own");
    return this.writeCredential({ actor, targetUserId: actor.userId, source: "own", apiKey, options, admin: false });
  }

  async setPilot(headers: Headers, targetUserId: string, apiKey: string, options: AiCredentialRequestOptions): Promise<Record<string, unknown>> {
    const actor = await this.assertFreshPrincipal(headers, "admin", options.expectedActorContext);
    const replay = await this.preflightCredentialWrite({ actor, targetUserId, source: "pilot", apiKey, options, admin: true });
    if (replay) return replay;
    await this.validateKey(apiKey, "pilot");
    return this.writeCredential({ actor, targetUserId, source: "pilot", apiKey, options, admin: true });
  }

  private async removeCredential(input: {
    actor: Principal;
    targetUserId: string;
    source: CredentialSource;
    options: AiCredentialRequestOptions;
    admin: boolean;
  }): Promise<Record<string, unknown>> {
    const { actor, targetUserId, source, options, admin } = input;
    if (!admin && actor.userId !== targetUserId) throw new AiCredentialError("forbidden", "Der eigene KI-Zugang gehört zu deinem Konto.", 403);
    const action = admin ? "ai-credential-pilot-remove" : "ai-credential-own-remove";
    const fingerprint = this.requestFingerprint(action, targetUserId, source, options, null);
    return this.auth.database.transaction(async client => {
      await lockState(client);
      const currentActor = await this.auth.checkPrincipal(client, actor.sessionId, admin ? "admin" : "active", true, true);
      if (currentActor.userId !== actor.userId || currentActor.generation !== actor.generation) {
        throw new AiCredentialError("session_changed", "Deine Kontositzung hat sich geändert. Bitte neu laden.", 409);
      }
      assertActorContext(options.expectedActorContext, actorContext(currentActor));
      const replay = await this.replay(client, actor.userId, options.requestId, fingerprint);
      if (replay) return replay as Record<string, unknown>;
      if (admin) {
        await this.assertTargetContext(client, targetUserId, options.expectedTargetContext, false);
      }
      await this.takeWriteLimit(client, actor.userId, action);
      const row = await this.credential(client, targetUserId, source);
      if (!row?.configured) throw new AiCredentialError("not_found", "Der KI-Zugang ist nicht eingerichtet.", 404);
      if (row.revision !== options.expectedRevision) throw conflict("Der KI-Zugang wurde inzwischen geändert. Bitte neu laden.");
      await client.query(`UPDATE stex.ai_credentials SET encrypted_key=NULL,key_fingerprint=NULL,key_suffix=NULL,configured=false,
        revision=revision+1,updated_at=now(),updated_by_user_id=$2 WHERE credential_id=$1`, [row.credential_id, actor.userId]);
      const selected = await this.selection(client, targetUserId);
      let selection = selected;
      if (selected.selected_source === source) {
        const nextRevision = selected.revision + 1;
        await client.query(`INSERT INTO stex.ai_credential_selections(owner_user_id,selected_source,revision,updated_by_user_id)
          VALUES($1,'off',$2,$3) ON CONFLICT(owner_user_id) DO UPDATE SET selected_source='off',revision=EXCLUDED.revision,updated_at=now(),updated_by_user_id=EXCLUDED.updated_by_user_id`,
        [targetUserId, nextRevision, actor.userId]);
        selection = { selected_source: "off", revision: nextRevision };
      }
      const result = { contractVersion: 2, ownerUserId: targetUserId, source, configured: false, revision: row.revision + 1,
        selectedSource: selection.selected_source, selectionRevision: selection.revision,
        providerRevocationRequired: true, replay: false };
      await this.record(client, actor.userId, targetUserId, action, options.requestId, fingerprint, result);
      await this.bump(client);
      return result;
    });
  }

  async removeOwn(headers: Headers, options: AiCredentialRequestOptions): Promise<Record<string, unknown>> {
    const actor = await this.assertFreshPrincipal(headers, "active", options.expectedActorContext);
    return this.removeCredential({ actor, targetUserId: actor.userId, source: "own", options, admin: false });
  }

  async removePilot(headers: Headers, targetUserId: string, options: AiCredentialRequestOptions): Promise<Record<string, unknown>> {
    const actor = await this.assertFreshPrincipal(headers, "admin", options.expectedActorContext);
    return this.removeCredential({ actor, targetUserId, source: "pilot", options, admin: true });
  }

  async select(headers: Headers, source: SelectedSource, options: AiCredentialRequestOptions): Promise<Record<string, unknown>> {
    const actor = await this.assertFreshPrincipal(headers, "active", options.expectedActorContext);
    const action = "ai-credential-select";
    const fingerprint = this.requestFingerprint(action, actor.userId, source, options, null);
    return this.auth.database.transaction(async client => {
      await lockState(client);
      const current = await this.auth.checkPrincipal(client, actor.sessionId, "active", true, true);
      if (current.userId !== actor.userId || current.generation !== actor.generation) {
        throw new AiCredentialError("session_changed", "Deine Kontositzung hat sich geändert. Bitte neu laden.", 409);
      }
      assertActorContext(options.expectedActorContext, actorContext(current));
      const replay = await this.replay(client, actor.userId, options.requestId, fingerprint);
      if (replay) return replay as Record<string, unknown>;
      await this.takeWriteLimit(client, actor.userId, action);
      const previous = await this.selection(client, actor.userId);
      if (previous.revision !== options.expectedRevision) throw conflict("Deine KI-Auswahl wurde inzwischen geändert. Bitte neu laden.");
      if (source !== "off") {
        const key = await this.credential(client, actor.userId, source);
        if (!key?.configured) throw new AiCredentialError("credential_missing", source === "pilot" ? missingPilot : missingOwn, 409);
      }
      const revision = previous.revision + 1;
      await client.query(`INSERT INTO stex.ai_credential_selections(owner_user_id,selected_source,revision,updated_by_user_id)
        VALUES($1,$2,$3,$4) ON CONFLICT(owner_user_id) DO UPDATE SET selected_source=EXCLUDED.selected_source,revision=EXCLUDED.revision,updated_at=now(),updated_by_user_id=EXCLUDED.updated_by_user_id`,
      [actor.userId, source, revision, actor.userId]);
      const result = { contractVersion: 2, source, revision, replay: false };
      await this.record(client, actor.userId, actor.userId, action, options.requestId, fingerprint, result);
      await this.bump(client);
      return result;
    });
  }

  async adminPilotStatus(headers: Headers, targetUserId: string): Promise<Record<string, unknown>> {
    const admin = await this.auth.principal(headers, "admin");
    return this.auth.database.transaction(async client => {
      await lockState(client);
      const currentAdmin = await this.auth.checkPrincipal(client, admin.sessionId, "admin", false, true);
      await atomicLimit(client, `ai-credential-admin-status:${admin.userId}`, 60, 60);
      const target = (await client.query<{ status: string; role: string; generation: number }>(
        "SELECT a.status,a.role,x.generation FROM stex.accounts a JOIN stex.account_access x ON x.user_id=a.user_id WHERE a.user_id=$1",
        [targetUserId],
      )).rows[0];
      if (!target) throw new AiCredentialError("not_found", "Konto nicht gefunden.", 404);
      const row = await this.credential(client, targetUserId, "pilot");
      const selection = await this.selection(client, targetUserId);
      return {
        contractVersion: 2,
        actorContext: actorContext(currentAdmin),
        targetContext: targetContext(targetUserId, target.generation),
        target: { userId: targetUserId, status: target.status, role: target.role },
        credential: { configured: !!row?.configured, revision: row?.revision ?? 0, maskedKey: row?.configured && row.key_suffix ? `••••${row.key_suffix}` : null },
        selected: selection.selected_source === "pilot",
      };
    });
  }

  static verifyBackupRows(rows: Array<Record<string, unknown>>, selections: Array<Record<string, unknown>>, secrets?: CredentialSecrets): void {
    const configured = new Set<string>();
    for (const row of rows) {
      if (typeof row.credential_id !== "string" || typeof row.owner_user_id !== "string"
        || (row.source !== "pilot" && row.source !== "own") || typeof row.configured !== "boolean"
        || typeof row.revision !== "number" || !Number.isSafeInteger(row.revision) || row.revision < 0) {
        throw new Error("Sicherung enthält ungültige KI-Schlüsselmetadaten.");
      }
      if (row.configured !== true) {
        if (row.encrypted_key !== null || row.key_fingerprint !== null || row.key_suffix !== null) throw new Error("Sicherung enthält widersprüchliche KI-Schlüsselmetadaten.");
        continue;
      }
      if (!secrets) throw new Error("Für die KI-Schlüssel-Wiederherstellung fehlt das getrennte Entschlüsselungsgeheimnis.");
      if (typeof row.encrypted_key !== "string" || typeof row.key_fingerprint !== "string"
        || typeof row.key_suffix !== "string" || !/^[0-9a-f]{64}$/.test(row.key_fingerprint)
        || !/^[\s\S]{4}$/.test(row.key_suffix) || row.revision < 1) throw new Error("Sicherung enthält unvollständige KI-Schlüsselmetadaten.");
      verifyCredentialCiphertext(row.encrypted_key, row.key_fingerprint,
        { credentialId: row.credential_id, ownerUserId: row.owner_user_id, source: row.source }, secrets);
      configured.add(`${row.owner_user_id}\0${row.source}`);
    }
    for (const row of selections) {
      if (typeof row.owner_user_id !== "string" || typeof row.revision !== "number"
        || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error("Sicherung enthält eine ungültige KI-Auswahl.");
      if (row.selected_source !== "off" && (row.selected_source !== "pilot" && row.selected_source !== "own")) {
        throw new Error("Sicherung enthält eine ungültige KI-Auswahl.");
      }
      if (row.selected_source !== "off" && !configured.has(`${row.owner_user_id}\0${row.selected_source}`)) {
        throw new Error("Sicherung enthält eine KI-Auswahl ohne gespeicherten Zugang.");
      }
    }
  }
}
