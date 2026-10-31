import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { AccountService } from "../../src/lib/server/auth/service";
import { tokenHash } from "../../src/lib/server/auth/security";
import { lockState } from "../../src/lib/server/persistence/repository";

export const syntheticPassword = "PDF-A Synthetic Test 2026!";
export function syntheticPdf(pages = 3, largeBytes = 0, solution = false): Buffer {
  const objects = ["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const kids: string[] = [];
  for (let index = 1; index <= pages; index++) {
    const pageId = objects.length + 1, streamId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ${index === 3 ? '/Rotate 90' : ''} /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    const text = `BT /F1 18 Tf 50 750 Td (PDF-A ${solution ? 'Loesung' : 'Sachverhalt'} - Seite ${index}) Tj 0 -40 Td (Kaufmaennisches Bestaetigungsschreiben) Tj 0 -30 Td (Paragraph 172 ZPO - synthetischer Testtext) Tj 0 -30 Td (Zweite Fundstelle: Kaufmaennisches Bestaetigungsschreiben) Tj ET`;
    objects.push(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
  }
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`;
  if (largeBytes) objects.push(`<< /Length ${largeBytes} >>\nstream\n${'x'.repeat(largeBytes)}\nendstream`);
  let result = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(result)); result += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(result);
}
export class SyntheticAccount {
  cookies = new Map<string, string>();
  constructor(readonly service: AccountService, readonly name: string) {}
  headers() { return new Headers({ cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ') }); }
  async auth(path: string, body?: unknown) {
    const headers = this.headers();
    if (body !== undefined) { headers.set('content-type', 'application/json'); headers.set('origin', this.service.baseURL); headers.set('x-stex-action', '1'); }
    if (path.startsWith('/verify-email')) { headers.set('sec-fetch-site', 'cross-site'); headers.set('sec-fetch-mode', 'navigate'); }
    const response = await this.service.authHTTP(new Request(`${this.service.baseURL}/api/auth${path}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) }));
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], split = pair.indexOf('=');
      this.cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
    assert.ok(response.status < 400, `${path}: ${response.status} ${await response.clone().text()}`);
    return response;
  }
  async initialize(active = true) {
    const email = `${this.name}@example.test`, token = randomBytes(32).toString('base64url');
    await this.service.database.transaction(async client => {
      await lockState(client);
      await client.query("INSERT INTO stex.accounts(user_id,status,role,revision) VALUES($1,'pending','member',1)", [this.name]);
      await client.query("INSERT INTO stex.account_invitations(id,user_id,email,name,token_hash,expires_at) VALUES($1,$2,$3,$2,$4,now()+interval '1 day')", [randomUUID(), this.name, email, tokenHash(token)]);
    });
    await this.auth('/sign-up/email', { email, password: syntheticPassword, invitationToken: token });
    const mail = (await this.service.localMails(email)).find(item => item.purpose === 'verification')!;
    const url = new URL(mail.url); await this.auth(`${url.pathname.replace('/api/auth', '')}${url.search}`);
    if (active) await this.service.database.transaction(async client => {
      await lockState(client);
      await client.query("UPDATE stex.accounts SET status='active',revision=revision+1 WHERE user_id=$1", [this.name]);
      await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1", [this.name]);
    });
    await this.auth('/sign-in/email', { email, password: syntheticPassword });
  }
}
