import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { testRuntime } from "../scripts/data-migration/postgres-test-runtime";
import { SyntheticAccount, syntheticPdf } from "../scripts/pdf-a/fixtures";
import { AccountService } from "../src/lib/server/auth/service";
import { CatalogImportService, validateCatalogPdf } from "../src/lib/server/catalog/import-service";
import { CatalogPdfService } from "../src/lib/server/catalog-pdf/service";
import { catalogPdfHTTP, byteRange } from "../src/lib/server/catalog-pdf/http";
import { findQuote, pageText } from "../src/lib/pdf-viewer/text";
import { pdfFileURL, pdfViewerURL } from "../src/lib/pdf-viewer/contract";
import { fromViewport, toViewport } from "../src/lib/pdf-viewer/geometry";
import { storageKey, fileHash } from "../src/lib/server/persistence/files";
import { lockState } from "../src/lib/server/persistence/repository";

test("PDF-A: Range parsing handles bounded/open/suffix ranges and invalid inputs", () => {
  assert.deepEqual(byteRange('bytes=0-9', 100), {start:0,end:9});
  assert.deepEqual(byteRange('bytes=90-', 100), {start:90,end:99});
  assert.deepEqual(byteRange('bytes=-10', 100), {start:90,end:99});
  assert.deepEqual(byteRange('bytes=90-200', 100), {start:90,end:99});
  for (const value of ['bytes=100-', 'bytes=20-10', 'bytes=-0', 'bytes=0-1,5-6', 'bytes=-', 'bytes=999999999999999999-', 'wat=0-1']) assert.equal(byteRange(value, 100), null);
});
test("PDF-A: searchable original positions preserve line breaks, ligatures and occurrence", () => {
  const text = pageText([{str:'Kaufmän-',hasEOL:true},{str:'nisches Bestätigungsschreiben',hasEOL:true},{str:'kaufmännisches Bestätigungsschreiben'}]);
  const first = findQuote(text.text, 'KAUFMÄNNISCHES BESTÄTIGUNGSSCHREIBEN')!;
  assert.equal(text.text.slice(first.start, first.end), 'Kaufmän-\nnisches Bestätigungsschreiben');
  const second = findQuote(text.text, 'kaufmännisches Bestätigungsschreiben', 1)!;
  assert.ok(second.start > first.end);
  assert.equal(findQuote(text.text, 'fehlt'), null);
  assert.equal(findQuote('ofﬁce', 'office')?.end, 5);
  assert.deepEqual(findQuote('😀 Test', 'Test'), {start:3,end:7});
});
test("PDF-A: geometry maps rotated/zoomed CropBox positions reversibly", () => {
  for(const matrix of [[2,0,0,-2,-20,1700],[0,2,2,0,-40,-20],[-2,0,0,2,1210,-40],[0,-2,-2,0,1700,1210]]) {
    const geometry = {documentVersionId:'version',pageNumber:1,viewBox:[10,20,605,850],rotation:0,width:1190,height:1660,scale:2,viewportTransform:matrix};
    const point = toViewport(geometry,.25,.75), restored=fromViewport(geometry,point.x,point.y);
    assert.ok(Math.abs(restored.x-.25)<1e-9 && Math.abs(restored.y-.75)<1e-9);
  }
});
test("PDF-A: real sessions, shared access, triples, conditional/HEAD/Range denial and revocation", {timeout:240000}, async t => {
  const runtime = await testRuntime(); t.after(() => runtime.close());
  const repository = await runtime.repository('pdf_a');
  const auth = new AccountService({database:repository.database,files:repository.files,baseURL:'http://localhost:3046',secret:randomBytes(48).toString('hex'),mailKey:randomBytes(48).toString('hex')});
  const a = new SyntheticAccount(auth,'pdf-a'), b = new SyntheticAccount(auth,'pdf-b'), pending = new SyntheticAccount(auth,'pdf-pending');
  await a.initialize(); await b.initialize(); await pending.initialize(false);
  const catalog = new CatalogImportService(auth, repository.files);
  const bytes = syntheticPdf();
  const prepared = (role: 'sachverhalt' | 'loesung') => validateCatalogPdf({name:`${role}.pdf`,size:bytes.length,type:'application/pdf',arrayBuffer:async()=>Uint8Array.from(bytes).buffer},role);
  const submitted = await catalog.submit(a.headers(), {requestId:'pdf-test-import-001',metadata:{id:'pdf-case',source:'synthetic',title:'PDF-A',date:'',area:'zr',topicIds:[]},documents:[await prepared('sachverhalt'),await prepared('loesung')]});
  const [document, other] = submitted.summary.documents;
  const identity = {klausurId:'pdf-case',documentId:document.documentId,documentVersionId:document.documentVersionId};
  const personalKey = JSON.stringify(['document',a.name,'personal-document']);
  const key = storageKey(a.name,'personal-version'), hash = fileHash(bytes);
  await repository.files.put(key,bytes,hash);
  await auth.database.transaction(async client=>{
    await lockState(client);
    await client.query("INSERT INTO stex.personal_records VALUES($1,$2,'document','personal-document',1,'synthetic','{}','{}')",[personalKey,a.name]);
    await client.query("INSERT INTO stex.document_versions VALUES('personal-version','personal-document',$1,$2,$3,$4,'application/pdf',3,'ready',NULL,$5,'data:application/pdf;base64,')",[a.name,personalKey,hash,bytes.length,key]);
  });
  const pdf = new CatalogPdfService(auth, repository.files);
  const call = (headers: Headers, options: {method?:string;extra?:Record<string,string|undefined>;url?:string}={}) => {
    const merged = new Headers(headers); for(const [key,value] of Object.entries(options.extra??{}))if(value!==undefined)merged.set(key,value);
    return catalogPdfHTTP(new Request(`http://localhost:3046${options.url??pdfFileURL(identity)}`,{method:options.method??'GET',headers:merged}),pdf);
  };
  await t.test('active A and independent active B read exact bytes and descriptor',async()=>{
    for(const who of [a,b]) { const response=await call(who.headers()); assert.equal(response.status,200); assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes); assert.match(response.headers.get('cache-control')!,/private.*no-store/); }
    const described=await call(b.headers(),{url:pdfFileURL(identity,true)}); assert.equal((await described.json()).scope,'catalog');
    assert.equal(pdfViewerURL(identity,{pageNumber:2,quote:'Test'}).includes('page=2'),true);
  });
  await t.test('HEAD, prefix, suffix, open ranges, invalid 416, private conditionals',async()=>{
    const head=await call(b.headers(),{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(Number(head.headers.get('content-length')),bytes.length);
    for(const [range,start,end] of [['bytes=0-9',0,9],['bytes=-10',bytes.length-10,bytes.length-1],['bytes=10-',10,bytes.length-1]] as const){const result=await call(b.headers(),{extra:{range}});assert.equal(result.status,206);assert.deepEqual(Buffer.from(await result.arrayBuffer()),bytes.subarray(start,end+1));}
    const bad=await call(b.headers(),{extra:{range:'bytes=99999999-'}});assert.equal(bad.status,416);assert.equal(bad.headers.get('content-range'),`bytes */${bytes.length}`);
    for(const extra of [{'if-none-match':'*'},{'if-modified-since':'Wed, 21 Oct 2030 07:28:00 GMT'},{range:'bytes=0-9','if-range':'"guessed"'}])assert.equal((await call(b.headers(),{extra})).status,200);
  });
  await t.test('anonymous and pending never receive document metadata, even via 416/conditional/HEAD',async()=>{
    for(const headers of [new Headers(),pending.headers()]) for(const options of [{},{method:'HEAD'},{extra:{range:'bytes=99999999-'}},{extra:{'if-none-match':'*'}},{url:pdfFileURL(identity,true)}]){
      const response=await call(headers,options);assert.ok([401,403].includes(response.status));assert.equal(response.headers.has('content-range'),false);assert.equal(response.headers.has('etag'),false);assert.equal(response.headers.has('accept-ranges'),false);
    }
  });
  await t.test('mismatched case/document/version and personal IDs never enter shared storage',async()=>{
    for(const changed of [{...identity,klausurId:'foreign'},{...identity,documentId:other.documentId},{...identity,documentVersionId:'personal-version'},{...identity,documentId:'personal-document',documentVersionId:'personal-version'}])assert.equal((await call(b.headers(),{url:pdfFileURL(changed)})).status,404);
    const cross=await call(b.headers(),{extra:{'sec-fetch-site':'cross-site'}});assert.equal(cross.status,403);
    assert.equal((await call(a.headers(),{url:pdfFileURL({...identity,documentId:'personal-document',documentVersionId:'personal-version'})})).status,404);
    assert.equal((await repository.snapshot(a.name)).documentVersions['personal-version'].ownerUserId,a.name);
  });
  await t.test('account block invalidates the existing session before any new read',async()=>{
    await auth.database.transaction(async client=>{await lockState(client);await client.query("UPDATE stex.accounts SET status='blocked',revision=revision+1 WHERE user_id=$1",[b.name]);await client.query('UPDATE stex.account_access SET generation=generation+1 WHERE user_id=$1',[b.name]);});
    for(const options of [{},{method:'HEAD'},{extra:{range:'bytes=0-9'}},{extra:{range:'bytes=99999999-'}},{extra:{'if-none-match':'*'}},{url:pdfFileURL(identity,true)}]){const response=await call(b.headers(),options);assert.equal(response.status,401);assert.equal(response.headers.has('content-range'),false);}
    assert.equal((await call(a.headers())).status,200);
  });
});
