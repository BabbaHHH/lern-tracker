import { createHash } from "node:crypto";
import { mkdir,mkdtemp,readFile,readdir,symlink,writeFile,rm } from "node:fs/promises";
import { join,resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const source=process.cwd();
const destination=await mkdtemp(join(tmpdir(),"stex-auth-r1-source-"));
const rows:{path:string;sha256:string}[]=[];
const sha=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
async function copyFile(relative:string) {
  const bytes=await readFile(join(source,relative));
  await mkdir(join(destination,relative,".."),{recursive:true});
  await writeFile(join(destination,relative),bytes);
  rows.push({path:relative,sha256:sha(bytes)});
}
async function copyDirectory(relative:string) {
  for(const entry of await readdir(join(source,relative),{withFileTypes:true})) {
    if(entry.name.startsWith(".") || entry.isSymbolicLink())continue;
    const path=join(relative,entry.name);
    if(entry.isDirectory())await copyDirectory(path);
    else if(entry.isFile())await copyFile(path);
  }
}
for(const directory of ["src","db/migrations","scripts/auth/restfaelle"])await copyDirectory(directory);
for(const file of ["AGENTS.md","package.json","package-lock.json","next.config.ts","tsconfig.json","next-env.d.ts","postcss.config.mjs","eslint.config.mjs","tests/auth-restfaelle.test.ts","scripts/data-migration/postgres-test-runtime.ts"])await copyFile(file);
// A per-file and end-of-copy check excludes half-written concurrent DATA-C2 files.
for(const row of rows)if(sha(await readFile(join(source,row.path)))!==row.sha256)throw new Error("Quellstand während Kopie geändert; neue konsistente Momentaufnahme nötig.");
await symlink(resolve(source,"node_modules"),join(destination,"node_modules"),"dir");
const manifest={createdAt:new Date().toISOString(),source,copy:destination,node:process.version,files:rows,excluded:[".env*","db/.local","public",".git",".next*","private documents","existing tests other than this R1 test"],dependencyStrategy:"read-only symlink to installed node_modules; package and lock hashes captured"};
await writeFile(join(source,"docs/ergebnisse/AUTH-01/R1/quellstand.json"),JSON.stringify(manifest,null,2)+"\n");
const env:NodeJS.ProcessEnv={NODE_ENV:"development"};for(const key of ["PATH","TMPDIR","LANG","LC_ALL"])if(process.env[key])env[key]=process.env[key];
Object.assign(env,{NEXT_TELEMETRY_DISABLED:"1",STEX_AUTH_R1_SNAPSHOT:"1",STEX_AUTH_R1_REPORT_ROOT:join(source,"docs/ergebnisse/AUTH-01/R1")});
console.log("AUTH-A-R1: geprüfte aktuelle Quellkopie ohne private Konfiguration erstellt; nur neue Restfallprüfung startet.");
const child=spawn(process.execPath,["--import","tsx","--test","--test-reporter=spec","tests/auth-restfaelle.test.ts"],{cwd:destination,env,stdio:"inherit"});
const result=await new Promise<number>(resolve=>child.once("exit",code=>resolve(code??1)));
process.exitCode=result;
if(process.argv.includes("--keep-source"))console.log(`Isolierte Quellkopie erhalten: ${destination}`);
else await rm(destination,{recursive:true,force:true});
