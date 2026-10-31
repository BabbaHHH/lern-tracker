/** Disposable real HTTP app process; configuration contains synthetic credentials only. */
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { AccountService } from "../../../src/lib/server/auth/service";
import { Database } from "../../../src/lib/server/persistence/database";
const options=JSON.parse(await readFile(process.argv[2],"utf8"));
const database=new Database({...options.database,application_name:options.tag});
let release:(()=>void)|undefined;
const service=new AccountService({database,baseURL:options.base,secret:options.secret,mailKey:options.mailKey,
  afterSignup:options.pauseAfterAuth?async()=>{process.send?.({phase:"after-auth-commit"});await new Promise<void>(resolve=>{release=resolve;});}:undefined});
const server=createServer(async(req,res)=>{
  try {
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const request=new Request(`${options.base}${req.url}`,{method:req.method,headers:new Headers(req.headers as Record<string,string>),body:chunks.length?Buffer.concat(chunks):undefined});
    const response=req.url?.startsWith("/api/auth/")?await service.authHTTP(request):await service.accountHTTP(request);
    res.statusCode=response.status;for(const [key,value]of response.headers)if(key!=="set-cookie")res.setHeader(key,value);
    if(response.headers.getSetCookie().length)res.setHeader("set-cookie",response.headers.getSetCookie());
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.statusCode=503;res.end("Synthetischer Prüftransport nicht verfügbar.");}
});
await new Promise<void>(resolve=>server.listen(Number(new URL(options.base).port),"127.0.0.1",resolve));
process.send?.({phase:"ready"});
process.on("message",message=>{
  if(message==="continue")release?.();
  if(message==="stop")server.close(()=>void database.close().then(()=>process.exit(0)));
});
process.on("disconnect",()=>server.close(()=>void database.close().then(()=>process.exit(0))));
