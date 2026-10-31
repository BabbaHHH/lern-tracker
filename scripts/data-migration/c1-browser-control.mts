/** Only changes the named disposable C1 fixture, never the normal local database. */
import { readFile } from "node:fs/promises";
import { join,resolve } from "node:path";
import { Database } from "../../src/lib/server/persistence/database";
import { lockState } from "../../src/lib/server/persistence/repository";
const root=resolve(process.argv[2]);
if(!/^\/private\/tmp\/stex-c1-browser-[a-zA-Z0-9]+$/.test(root) || process.argv[3]!=="block-b")throw new Error("Nur block-b in der eigenen synthetischen C1-Fixture ist zugelassen.");
const port=Number((await readFile(join(root,"postgres","postmaster.pid"),"utf8")).split("\n")[3]);
const database=new Database({host:"127.0.0.1",port,user:"stex_local",password:(await readFile(join(root,"postgres-password"),"utf8")).trim(),database:"stex_local"});
try {await database.transaction(async client=>{await lockState(client);await client.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id='c1-browser-b'");await client.query("UPDATE stex.account_access SET generation=generation+1 WHERE user_id='c1-browser-b'");});console.log("Nur synthetisches C1-Konto B gesperrt.");}finally{await database.close();}
