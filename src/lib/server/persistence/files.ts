import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, realpath, unlink } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import { digest } from "../../data-migration/migration";

export function fileHash(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
export function storageKey(owner: string, versionId: string): string {
  return `objects/${digest(owner)}/${digest(versionId)}.bin`;
}
/** Immutable files outside public/. No original filename or input path is used. */
export class PrivateFiles {
  readonly root: string;
  constructor(root: string) {
    if (!isAbsolute(root)) throw new Error("Privater Dateispeicher braucht einen absoluten Pfad.");
    this.root = resolve(root);
    if (this.root.split(sep).includes("public")) throw new Error("Dateispeicher darf nicht öffentlich sein.");
  }
  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    if ((await lstat(this.root)).isSymbolicLink() || (await realpath(this.root)).split(sep).includes("public")) throw new Error("Ungültiger privater Speicherpfad.");
  }
  async requireEmpty(): Promise<void> {
    await this.initialize();
    if ((await readdir(this.root)).length) throw new Error("Wiederherstellung braucht einen leeren privaten Dateispeicher.");
  }
  private async location(key: string): Promise<string> {
    if (!/^objects\/[0-9a-f]{64}\/[0-9a-f]{64}\.bin$/.test(key)) throw new Error("Ungültige interne Dateikennung.");
    await this.initialize();
    const parts = key.split("/");
    let parent = this.root;
    for (const part of parts.slice(0, -1)) {
      parent = join(parent, part);
      await mkdir(parent, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
      const stat = await lstat(parent);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Dateipfad enthält keine private Verzeichnisstruktur.");
    }
    return join(parent, parts.at(-1)!);
  }
  async read(key: string, sha256: string, size: number): Promise<Buffer> {
    const path = await this.location(key);
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const bytes = await handle.readFile();
      if (bytes.length !== size || fileHash(bytes) !== sha256) throw new Error("Private Datei fehlt oder ist beschädigt.");
      return bytes;
    } finally { await handle.close(); }
  }
  async put(key: string, bytes: Buffer, sha256: string): Promise<void> {
    if (fileHash(bytes) !== sha256) throw new Error("Dateiprüfsumme stimmt nicht.");
    const path = await this.location(key);
    const temporary = `${path}.${randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    try {
      await link(temporary, path).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
      await this.read(key, sha256, bytes.length); // existing content must be identical
      const directory = await open(join(path, ".."), "r");
      try { await directory.sync(); } finally { await directory.close(); }
    } finally { await unlink(temporary); }
  }
}
