import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { AccountService } from "../auth/service";
import { AccountError, tokenHash } from "../auth/security";
import { lockState } from "../persistence/repository";
import type { PrivateFiles } from "../persistence/files";
import type { PdfIdentity, PdfDescriptor } from "../../pdf-viewer/contract";
import { recordDownload } from "./downloads";

interface PdfSnapshot {
  descriptor: PdfDescriptor;
  storageKey: string;
  sha256: string;
  identityProof: unknown;
}

/** Resolve only the exact shared relation. Personal document_versions never
 * participate, even for administrators or a personal file's owner. */
async function snapshot(client: PoolClient, identity: PdfIdentity): Promise<PdfSnapshot> {
  const row = (await client.query(`SELECT d.role,v.document_id,v.document_version_id,v.version_number,
      v.source_filename,v.byte_size,v.page_count,v.text_status,v.storage_key,v.sha256,c.payload->>'title' AS title,
      jsonb_build_array(c.record_key,c.id,c.kind,c.revision,
        d.document_id,d.record_key,d.klausur_id,d.role,d.source_reference,d.created_by_user_id,d.created_at::text,
        v.document_version_id,v.document_id,v.version_number,v.sha256,v.byte_size,v.media_type,
        v.storage_key,v.data_url_header,v.source_filename,v.submitted_by_user_id,v.import_id,v.created_at::text) AS identity_proof
    FROM stex.catalog_documents d
    JOIN stex.catalog_document_versions v ON v.document_id=d.document_id
    JOIN stex.catalog_records c ON c.record_key=d.record_key AND c.id=d.klausur_id
    WHERE c.kind='klausur' AND d.klausur_id=$1 AND d.document_id=$2 AND v.document_version_id=$3`,
  [identity.klausurId, identity.documentId, identity.documentVersionId])).rows[0];
  if (!row) throw new AccountError("not_found", "Dieses Katalogdokument ist nicht verfügbar.", 404);
  return {
    descriptor: { ...identity, contractVersion: 1, scope: "catalog", role: row.role,
      title: row.title, sourceFilename: row.source_filename, versionNumber: row.version_number,
      byteSize: Number(row.byte_size), pageCount: row.page_count, textStatus: row.text_status },
    storageKey: row.storage_key, sha256: row.sha256, identityProof: row.identity_proof,
  };
}

export class CatalogPdfService {
  constructor(readonly auth: AccountService, readonly files: PrivateFiles) {}

  async read<T>(headers: Headers, identity: PdfIdentity, work: {
    needsBytes: (descriptor: PdfDescriptor) => boolean;
    /** Synchronous response assembly only; never perform file I/O here. */
    respond: (descriptor: PdfDescriptor, bytes: Buffer | undefined) => T;
    /** Explicit download command; never set for viewer/HEAD/description/ranges. */
    downloadRequestId?: string;
  }): Promise<T> {
    const principal = await this.auth.principal(headers, "active");
    if (Object.values(identity).some(value => !value || value.length > 255 || /[\x00-\x1f]/.test(value))) {
      throw new AccountError("invalid_input", "Die Dokumentzuordnung fehlt oder ist ungültig.");
    }
    if (work.downloadRequestId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(work.downloadRequestId)) {
      throw new AccountError("invalid_input", "Der Downloadauftrag ist ungültig.");
    }
    // Phase 1: consistent metadata and session snapshot, without writer locks.
    const initial = await this.auth.database.transaction(async client => ({
      who: await this.auth.checkPrincipal(client, principal.sessionId, "active"),
      file: await snapshot(client, identity),
    }), true);

    // Phase 2: no connection, transaction, account lock or global state lock is
    // retained during the unchanged full-file/size/SHA and path/symlink checks.
    const bytes = work.needsBytes(initial.file.descriptor)
      ? await this.files.read(initial.file.storageKey, initial.file.sha256, initial.file.descriptor.byteSize)
      : undefined;

    // Phase 3: linearize response authorization against account/catalog writers.
    // A committed revocation or target change during file I/O denies all bytes.
    return this.auth.database.transaction(async client => {
      await lockState(client);
      const who = await this.auth.checkPrincipal(client, principal.sessionId, "active", false, true);
      if (who.userId !== initial.who.userId || who.identityId !== initial.who.identityId
        || who.sessionId !== initial.who.sessionId || who.generation !== initial.who.generation) {
        throw new AccountError("unauthenticated", "Bitte neu anmelden.", 401);
      }
      const current = await snapshot(client, identity);
      if (!isDeepStrictEqual(initial.file.identityProof, current.identityProof)) {
        throw new AccountError("conflict", "Die Dokumentzuordnung wurde geändert. Bitte erneut öffnen.", 409);
      }
      // HEAD, description and 416 also pass this final check before metadata is
      // assembled. A response reaches the caller only after transaction commit.
      const response = work.respond(current.descriptor, bytes);
      if (work.downloadRequestId !== undefined) {
        if (!bytes) throw new Error("Download requires verified bytes");
        await recordDownload(client, who.userId, work.downloadRequestId,
          tokenHash(JSON.stringify([identity.klausurId, identity.documentId, identity.documentVersionId, current.identityProof])));
      }
      return response;
    });
  }
}
