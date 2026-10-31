import { mkdir, open, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { PoolClient } from "pg";
import type { JsonObject, JsonValue } from "../../data-migration/contract";
import { canonical, digest } from "../../data-migration/migration";
import { isObject } from "../../data-migration/validation";
import { Database } from "./database";
import { PrivateFiles } from "./files";
import { lockState } from "./repository";
import { seal, tokenHash, unseal } from "../auth/security";
import { AiCredentialService } from "../ai-credentials/service";
import { credentialSecretsFromEnvironment } from "../ai-credentials/crypto";

// Fixed table and column names: backup contents never become SQL instructions.
const columns = {
  state: ["singleton","contract_version","generation"],
  accounts: ["user_id","status","role","revision"],
  topics: ["id"],
  catalog_records: ["record_key","kind","id","revision","legacy_key","payload","normalized"],
  personal_records: ["record_key","owner_user_id","kind","id","revision","legacy_key","payload","normalized"],
  learning_commands: ["owner_user_id","request_id","contract_version","action","fingerprint","before_values","result","created_at"],
  record_references: ["source_key","path","owner_user_id","source_personal_key","source_catalog_key","target_personal_key","target_catalog_key","target_topic_id"],
  document_versions: ["document_version_id","document_id","owner_user_id","record_key","sha256","byte_size","media_type","page_count","text_status","extraction_version","storage_key","data_url_header"],
  document_pages: ["document_version_id","page_number","printed_label","width","height","rotation","text_status","extraction_version"],
  annotations: ["id","owner_user_id","document_version_id","page_number","rectangles","quote","note","revision"],
  imports: ["owner_user_id","request_id","source_digest","exported_at","areas"],
  import_records: ["owner_user_id","request_id","record_key","revision","personal_key","catalog_key"],
  import_documents: ["owner_user_id","request_id","document_version_id"],
  catalog_imports: ["import_id","submitted_by_user_id","request_id","source_digest","source_reference","status","acceptance_mode","content_check","technical_validation","duplicate_status","klausur_id","metadata","warnings","error_code","error_message","created_at","updated_at","completed_at"],
  catalog_documents: ["document_id","record_key","klausur_id","role","source_reference","created_by_user_id","created_at"],
  catalog_document_versions: ["document_version_id","document_id","version_number","sha256","byte_size","media_type","page_count","text_status","extraction_version","storage_key","data_url_header","source_filename","submitted_by_user_id","import_id","created_at"],
  catalog_import_documents: ["import_id","document_version_id","role"],
  account_access: ["user_id","generation","created_at","updated_at"],
  auth_user: ["id","name","email","emailVerified","image","createdAt","updatedAt","twoFactorEnabled","stexAccountId","invitationId"],
  auth_account: ["id","accountId","providerId","userId","accessToken","refreshToken","idToken","accessTokenExpiresAt","refreshTokenExpiresAt","scope","password","createdAt","updatedAt"],
  auth_session: ["id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId","stexGeneration","factorVerifiedAt"],
  auth_verification: ["id","identifier","value","expiresAt","createdAt","updatedAt"],
  auth_two_factor: ["id","secret","backupCodes","userId","verified","failedVerificationCount","lockedUntil"],
  auth_identities: ["user_id","auth_user_id"],
  account_invitations: ["id","user_id","email","name","token_hash","expires_at","consumed_at","revoked_at","created_at","created_by"],
  auth_bootstrap: ["singleton","user_id","expires_at","completed_at"],
  account_audit: ["id","actor","target","action","request_id","fingerprint","result","created_at"],
  auth_email_tokens: ["token_hash","email","expires_at"],
  auth_mail_outbox: ["id","email","purpose","sealed","expires_at","created_at","dispatch_status","dispatch_attempts","next_attempt_at","claim_token","lease_until","last_error_code","sent_at"],
  auth_limits: ["key","count","reset_at"],
  ai_credentials: ["credential_id","owner_user_id","source","encrypted_key","key_fingerprint","key_suffix","configured","revision","created_at","updated_at","created_by_user_id","updated_by_user_id"],
  ai_credential_selections: ["owner_user_id","selected_source","revision","updated_at","updated_by_user_id"],
  catalog_pdf_downloads: ["owner_user_id","request_id","download_day","slot","fingerprint","created_at"],
  catalog_metadata_commands: ["owner_user_id","request_id","action","fingerprint","result","created_at"],
} as const;
type Table = keyof typeof columns;
const libraryTables = new Set<Table>(["auth_user","auth_account","auth_session","auth_verification","auth_two_factor"]);
function tableName(table: Table): string { return libraryTables.has(table) ? `public.stex_${table}` : `stex.${table}`; }
type Rows = Record<Table, JsonObject[]>;
interface BackupContent {
  format: "stex-postgres-private-files";
  version: 4;
  migrations: { name: string; sha256: string }[];
  rows: Rows;
}
interface BackupManifest extends BackupContent { sha256: string }
export interface AuthBackupProtection { encryptionKey: string; authSecret: string }
function requireProtection(protection?: AuthBackupProtection): asserts protection is AuthBackupProtection {
  if (!protection || protection.encryptionKey.length<32 || protection.authSecret.length<32 || protection.encryptionKey===protection.authSecret) {
    throw new Error("Auth-Sicherung benötigt getrennten Sicherungsschlüssel und ursprüngliches Authgeheimnis.");
  }
}
async function capture(client: PoolClient): Promise<BackupContent> {
  const migrations = (await client.query<{name: string;sha256: string}>("SELECT * FROM stex.schema_migrations ORDER BY name")).rows;
  const rows = {} as Rows;
  for (const table of Object.keys(columns) as Table[]) {
    const [schema,name]=tableName(table).split(".");
    const actual=await client.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2",[schema,name]);
    if(canonical(actual.rows.map(r=>r.column_name).sort())!==canonical([...columns[table]].sort()))throw new Error("Sicherungsschema ist unvollständig oder verändert.");
    const result = await client.query<{row: JsonObject}>(`SELECT to_jsonb(t) AS row FROM ${tableName(table)} t`);
    rows[table] = result.rows.map(item => item.row).sort((a,b) => canonical(a).localeCompare(canonical(b),"en"));
  }
  return { format:"stex-postgres-private-files",version:4,migrations,rows };
}
function validateManifest(input: unknown): BackupManifest {
  if (!isObject(input) || input.format !== "stex-postgres-private-files" || input.version !== 4 || typeof input.sha256 !== "string"
    || !isObject(input.rows) || !Array.isArray(input.migrations)) throw new Error("Unbekanntes Sicherungsformat.");
  const { sha256, ...content } = input;
  if (digest(content) !== sha256) throw new Error("Sicherungsmanifest ist beschädigt.");
  if (canonical(Object.keys(input.rows).sort()) !== canonical(Object.keys(columns).sort())) throw new Error("Sicherungstabellen stimmen nicht überein.");
  for (const table of Object.keys(columns) as Table[]) {
    const rows = input.rows[table];
    if (!Array.isArray(rows) || rows.some(row => !isObject(row) || canonical(Object.keys(row).sort()) !== canonical([...columns[table]].sort()))) throw new Error("Sicherungsspalten stimmen nicht überein.");
  }
  const state = (input.rows.state as JsonObject[]);
  if (state.length !== 1 || state[0].singleton !== true || state[0].contract_version !== 1
    || typeof state[0].generation !== "number" || !Number.isSafeInteger(state[0].generation) || state[0].generation < 0) throw new Error("Ungültiger Sicherungsstand.");
  return input as unknown as BackupManifest;
}

/** Logical, provider-independent full backup. The manifest is published only after all files verify. */
export async function backup(database: Database, files: PrivateFiles, directory: string, protection?: AuthBackupProtection): Promise<{sha256: string; fileCount: number; generation: number}> {
  const backupFiles = new PrivateFiles(join(directory,"files")); // validates absolute/private path
  await mkdir(directory,{mode:0o700}); // never overwrite an existing backup
  return database.transaction(async client => {
    const generation = await lockState(client); // every repository writer shares this lock
    await client.query(`LOCK TABLE ${[...Object.keys(columns) as Table[]].map(tableName).join(",")} IN SHARE MODE`);
    const content = await capture(client);
    const containsAuth=content.rows.auth_user.length>0 || content.rows.auth_verification.length>0 || content.rows.auth_mail_outbox.length>0 || content.rows.account_invitations.length>0 || content.rows.auth_bootstrap.length>0 || content.rows.account_audit.length>0 || content.rows.ai_credentials.length>0 || content.rows.ai_credential_selections.length>0;
    if(containsAuth)requireProtection(protection);
    const hasAiCredentials = content.rows.ai_credentials.some(row => row.configured === true);
    if (content.rows.ai_credentials.length || content.rows.ai_credential_selections.length) {
      AiCredentialService.verifyBackupRows(content.rows.ai_credentials, content.rows.ai_credential_selections,
        hasAiCredentials ? credentialSecretsFromEnvironment() : undefined);
    }
    const versions = await client.query<{storage_key:string;sha256:string;byte_size:string}>(`SELECT storage_key,sha256,byte_size FROM stex.document_versions
      UNION ALL SELECT storage_key,sha256,byte_size FROM stex.catalog_document_versions ORDER BY storage_key`);
    for (const version of versions.rows) {
      const bytes = await files.read(version.storage_key,version.sha256,Number(version.byte_size));
      await backupFiles.put(version.storage_key,bytes,version.sha256);
    }
    const sha256 = digest(content);
    const handle = await open(join(directory,"manifest.tmp"),"wx",0o600);
    const manifest={...content,sha256};
    const output=containsAuth?{format:"stex-postgres-encrypted",version:4,sealed:seal(JSON.stringify({manifest,authSecretFingerprint:tokenHash(protection!.authSecret)}),protection!.encryptionKey)}:manifest;
    try { await handle.writeFile(JSON.stringify(output,null,2)); await handle.sync(); } finally { await handle.close(); }
    await rename(join(directory,"manifest.tmp"),join(directory,"manifest.json"));
    const directoryHandle = await open(directory,"r");
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    return { sha256,fileCount:versions.rows.length,generation };
  });
}

/** Restore only into a freshly migrated empty database and an empty private file target. */
export async function restore(database: Database, files: PrivateFiles, directory: string, protection?: AuthBackupProtection): Promise<{sha256: string; fileCount: number}> {
  let input:unknown=JSON.parse(await readFile(join(directory,"manifest.json"),"utf8"));
  const encrypted=isObject(input) && input.format==="stex-postgres-encrypted";
  if(encrypted) {
    requireProtection(protection);
    try {
      if(!isObject(input) || input.version!==4 || typeof input.sealed!=="string")throw new Error();
      const decoded=JSON.parse(unseal(input.sealed,protection.encryptionKey));
      if(decoded.authSecretFingerprint!==tokenHash(protection.authSecret))throw new Error();
      input=decoded.manifest;
    }catch{throw new Error("Geschützte Auth-Sicherung ist beschädigt oder Schlüssel stimmen nicht überein.");}
  }
  const manifest = validateManifest(input);
  if(!encrypted && (manifest.rows.auth_user.length || manifest.rows.auth_verification.length || manifest.rows.auth_mail_outbox.length || manifest.rows.account_invitations.length || manifest.rows.auth_bootstrap.length || manifest.rows.account_audit.length))throw new Error("Authdaten benötigen eine geschützte Sicherung.");
  const hasAiCredentials = manifest.rows.ai_credentials.some(row => row.configured === true);
  if (manifest.rows.ai_credentials.length || manifest.rows.ai_credential_selections.length) {
    AiCredentialService.verifyBackupRows(manifest.rows.ai_credentials, manifest.rows.ai_credential_selections,
      hasAiCredentials ? credentialSecretsFromEnvironment() : undefined);
  }
  const sourceFiles = new PrivateFiles(join(directory,"files"));
  return database.transaction(async client => {
    if (await lockState(client) !== 0) throw new Error("Wiederherstellung braucht eine leere Zieldatenbank.");
    const current = await capture(client);
    if (canonical(current.migrations) !== canonical(manifest.migrations)) throw new Error("Schema-/Migrationsstand der Sicherung stimmt nicht überein.");
    for (const table of Object.keys(columns) as Table[]) if (table !== "state" && current.rows[table].length) throw new Error("Wiederherstellung braucht eine leere Zieldatenbank.");
    await files.requireEmpty();
    // SEARCH-A1 is derived data, excluded from format 4. Fence any old worker;
    // restored catalog versions enqueue fresh jobs via migration 005's trigger.
    await client.query("TRUNCATE stex.search_pages,stex.search_jobs");
    // Publish immutable files before committing their metadata. Failure never exposes partial DB rows.
    for (const row of [...manifest.rows.document_versions,...manifest.rows.catalog_document_versions]) {
      const key = String(row.storage_key);
      const hash = String(row.sha256);
      const bytes = await sourceFiles.read(key,hash,Number(row.byte_size));
      await files.put(key,bytes,hash);
    }
    await client.query("DELETE FROM stex.state");
    for (const table of Object.keys(columns) as Table[]) {
      const names = columns[table];
      const placeholders = names.map((_,i) => `$${i+1}`).join(",");
      for (const row of manifest.rows[table]) {
        const args = names.map(name => ["payload","normalized","rectangles","areas","result","metadata","warnings","before_values"].includes(name) ? JSON.stringify(row[name]) : row[name] as JsonValue);
        const quoted=names.map(name=>`"${name}"`).join(",");
        const conflict=table==="account_access"?` ON CONFLICT(user_id) DO UPDATE SET generation=EXCLUDED.generation,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at`:"";
        await client.query(`INSERT INTO ${tableName(table)} (${quoted}) VALUES (${placeholders})${conflict}`,args);
      }
    }
    if (digest(await capture(client)) !== manifest.sha256) throw new Error("Wiederherstellung weicht von der Sicherung ab.");
    {
      // Library email verification is JWT based: revoke the app token registry too.
      await client.query("DELETE FROM public.stex_auth_session");
      await client.query("DELETE FROM public.stex_auth_verification");
      await client.query("DELETE FROM stex.auth_email_tokens");
      await client.query("DELETE FROM stex.auth_mail_outbox");
      await client.query("DELETE FROM stex.auth_limits");
      await client.query("UPDATE stex.account_access SET generation=generation+1,updated_at=now() WHERE user_id IN(SELECT user_id FROM stex.auth_identities)");
      await client.query("UPDATE stex.account_invitations SET revoked_at=now() WHERE consumed_at IS NULL AND revoked_at IS NULL");
      await client.query("UPDATE stex.auth_bootstrap SET expires_at=least(expires_at,now()) WHERE completed_at IS NULL");
    }
    return { sha256:manifest.sha256,fileCount:manifest.rows.document_versions.length + manifest.rows.catalog_document_versions.length };
  });
}
