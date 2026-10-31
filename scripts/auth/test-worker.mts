/** Disposable integration-test process; never used by the application or operators. */
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { Database } from "../../src/lib/server/persistence/database";
import { AccountService } from "../../src/lib/server/auth/service";
const options=JSON.parse(await readFile(process.argv[2],"utf8"));
const database=new Database(options.database);
const server=createServer(async(req,res)=>{
  try {
    const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));
    const request=new Request(`${base}${req.url}`,{method:req.method,headers:new Headers(req.headers as Record<string,string>),body:chunks.length?Buffer.concat(chunks):undefined});
    const response=req.url?.startsWith("/api/auth/")?await service.authHTTP(request):await service.accountHTTP(request);
    res.statusCode=response.status;for(const [k,v]of response.headers)if(k!=="set-cookie")res.setHeader(k,v);
    if(response.headers.getSetCookie().length)res.setHeader("set-cookie",response.headers.getSetCookie());
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.statusCode=503;res.end("Testtransport nicht verfügbar.");}
});
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
const address=server.address();if(!address || typeof address==="string")throw new Error("Testserver fehlt.");
const base=`http://127.0.0.1:${address.port}`;
const service=new AccountService({database,baseURL:base,secret:options.secret,mailKey:options.mailKey});
process.send?.({base});
process.once("message",()=>server.close(()=>void database.close().then(()=>process.exit(0))));
process.once("disconnect",()=>server.close(()=>void database.close().then(()=>process.exit(0))));
