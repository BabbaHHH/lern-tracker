import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

test("PDF-DL1: public download route retains the closed production runtime gate", async () => {
  const material = (label: string) => createHash("sha512").update(`PDF-DL1 public gate fixture ${label}`).digest("base64url");
  const values: Record<string, string | undefined> = {
    NODE_ENV: "production", STEX_AUTH_MODE: "production", STEX_AUTH_RUNTIME_RELEASE: undefined,
    STEX_LOCAL_DATA_DIR: undefined, STEX_LOCAL_POSTGRES_PORT: undefined,
    BETTER_AUTH_URL: "https://synthetic.example.test", DATABASE_URL: `postgres://pdf:${material("db")}@db.example.test:5432/pdf_download`,
    STEX_DATABASE_TLS: "verify-full", STEX_PRIVATE_FILE_ROOT: "/srv/stex/pdf-download-fixture/files",
    BETTER_AUTH_SECRET: material("auth"), STEX_AUTH_MAIL_KEY: material("mail"),
  };
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    const { POST } = await import("../src/app/api/catalog/pdf-download/route");
    const response = await POST(new Request("https://synthetic.example.test/api/catalog/pdf-download", { method: "POST",
      headers: { "x-stex-auth-runtime-release": "operator-approved" } }));
    assert.equal(response.status, 503); assert.equal(response.headers.has("content-disposition"), false);
    assert.equal((await response.json()).error.code, "production_auth_not_released");
    assert.match(response.headers.get("cache-control")!, /private.*no-store/);
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
