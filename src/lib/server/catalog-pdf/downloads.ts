import type { PoolClient } from "pg";
import { AccountError } from "../auth/security";

/** Call only under lockState, after byte verification and final authorization.
 * The database clock determines the Berlin calendar day after lock acquisition.
 * Replays are bound to the same account, exact target proof and original day. */
export async function recordDownload(client: PoolClient, owner: string, requestId: string, fingerprint: string): Promise<void> {
  const day = (await client.query<{ day: string }>(
    "SELECT to_char(clock_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS day")).rows[0].day;
  const previous = (await client.query<{ day: string; fingerprint: string }>(
    "SELECT download_day::text AS day,fingerprint FROM stex.catalog_pdf_downloads WHERE owner_user_id=$1 AND request_id=$2", [owner, requestId])).rows[0];
  if (previous) {
    if (previous.day !== day || previous.fingerprint !== fingerprint) {
      throw new AccountError("conflict", "Bitte den Download erneut starten.", 409);
    }
    return;
  }
  const next = (await client.query<{ slot: number | null }>(`SELECT min(s.value)::int AS slot FROM generate_series(1,5) s(value)
    WHERE NOT EXISTS(SELECT 1 FROM stex.catalog_pdf_downloads d WHERE d.owner_user_id=$1 AND d.download_day=$2::date AND d.slot=s.value)`, [owner, day])).rows[0].slot;
  if (next === null) throw new AccountError("download_limited", "Für heute sind keine weiteren PDF-Downloads möglich. Du kannst das Dokument weiterhin lesen.", 429);
  await client.query("INSERT INTO stex.catalog_pdf_downloads(owner_user_id,request_id,download_day,slot,fingerprint) VALUES($1,$2,$3,$4,$5)", [owner, requestId, day, next, fingerprint]);
}
