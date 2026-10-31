import assert from 'node:assert/strict';
import {test} from 'node:test';
import {accountCatalogHasSnapshot,accountCatalogStatus,catalogDataAfterReadError,catalogReadPresentation,CatalogReadCoordinator,CatalogReadFailure,readAccountCatalog} from '../src/lib/catalog/use-account-catalog';
import {SettingsClient} from '../src/lib/learning/settings-client';
import type {SettingsView} from '../src/lib/learning/settings-contract';

const response=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const identity={contractVersion:1,account:{userId:'member-a',status:'active',role:'member',revision:1,bootstrap:false}};
const catalog={contractVersion:1,klausuren:[]};

test('R48 catalog reads preserve source/status and choose only the matching account action',async()=>{
  for(const source of ['/api/account','/api/catalog/klausuren'] as const){
    for(const status of [401,403]){
      const transport=async(input:RequestInfo|URL)=>String(input)===source?response(status,{error:{message:'private server text'}}):response(200,String(input)==='/api/account'?identity:catalog);
      await assert.rejects(readAccountCatalog(new AbortController().signal,transport as typeof fetch),error=>{
        assert.ok(error instanceof CatalogReadFailure);
        assert.equal(error.kind,'http');
        assert.equal(error.status,status);
        assert.deepEqual(error.sources,[source]);
        const view=catalogReadPresentation(error);
        assert.equal(view?.href,status===401?'/konto/anmelden':'/konto');
        assert.equal(view?.actionLabel,status===401?'Anmelden':'Zum Kontobereich');
        return true;
      });
    }
  }
  const unavailable=async(input:RequestInfo|URL)=>String(input)==='/api/catalog/klausuren'?response(503,{}):response(200,identity);
  await assert.rejects(readAccountCatalog(new AbortController().signal,unavailable as typeof fetch),error=>{
    assert.ok(error instanceof CatalogReadFailure);
    assert.equal(error.status,503);
    const view=catalogReadPresentation(error);
    assert.equal(view?.href,undefined);
    assert.match(view?.message??'',/vorübergehend nicht verfügbar/);
    return true;
  });
  const network=async(input:RequestInfo|URL)=>{if(String(input)==='/api/account')throw Error('offline');return response(200,catalog);};
  await assert.rejects(readAccountCatalog(new AbortController().signal,network as typeof fetch),error=>{
    assert.ok(error instanceof CatalogReadFailure);
    assert.equal(error.kind,'network');
    assert.equal(error.status,null);
    assert.deepEqual(error.sources,['/api/account']);
    assert.equal(catalogReadPresentation(error)?.href,undefined);
    return true;
  });
  const malformed=async(input:RequestInfo|URL)=>String(input)==='/api/account'?new Response('{',{status:200}):response(200,catalog);
  await assert.rejects(readAccountCatalog(new AbortController().signal,malformed as typeof fetch),error=>{
    assert.ok(error instanceof CatalogReadFailure);
    assert.equal(error.kind,'response');
    assert.equal(error.status,200);
    assert.deepEqual(error.sources,['/api/account']);
    return true;
  });
});

test('R48 same-account catalog refresh returns to loading until its new read completes',()=>{
  const key='member-a:1:session-a';
  const ready={key,refresh:2,status:'ready' as const,hasSnapshot:true,role:'admin',entries:[{id:'kept',revision:3,metadata:{id:'kept',source:'source',title:'Saved catalog view',area:'zr' as const,date:'',topicIds:[]},documents:[]}],error:null};
  assert.equal(accountCatalogStatus('ready',key,ready,2),'ready');
  assert.equal(accountCatalogStatus('loading',key,ready,2),'loading');
  assert.equal(accountCatalogStatus('ready',key,ready,3),'loading');
  assert.equal(accountCatalogHasSnapshot(key,ready),true);
  assert.equal(accountCatalogStatus('ready','member-b:1:session-b',ready,2),'loading');
  const failedRefresh=catalogDataAfterReadError(ready,key,3,new CatalogReadFailure('network',null,['/api/catalog/klausuren']));
  assert.equal(accountCatalogStatus('ready',key,failedRefresh,3),'error');
  assert.equal(accountCatalogHasSnapshot(key,failedRefresh),true);
  assert.equal(failedRefresh.role,'admin');
  assert.strictEqual(failedRefresh.entries,ready.entries);
  for(const status of [401,403]){
    const revoked=catalogDataAfterReadError(ready,key,4,new CatalogReadFailure('http',status,['/api/account']));
    assert.equal(accountCatalogStatus('ready',key,revoked,4),'error');
    assert.equal(accountCatalogHasSnapshot(key,revoked),false);
    assert.equal(revoked.role,'');
    assert.deepEqual(revoked.entries,[]);
  }
  const serverFailure=catalogDataAfterReadError(ready,key,4,new CatalogReadFailure('http',503,['/api/catalog/klausuren']));
  assert.equal(accountCatalogHasSnapshot(key,serverFailure),true);
  const otherHttpFailure=catalogDataAfterReadError(ready,key,4,new CatalogReadFailure('http',404,['/api/catalog/klausuren']));
  assert.equal(accountCatalogHasSnapshot(key,otherHttpFailure),false);
});

test('R48 catalog timeout keeps its active source and remains a temporary error',async()=>{
  const coordinator=new CatalogReadCoordinator((signal,activity)=>new Promise((_resolve,reject)=>{
    activity('/api/catalog/klausuren',true);
    signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});
  }),5);
  coordinator.start(7);
  const pending=coordinator.bind(7,'member-a:1:session-a');
  assert.ok(pending);
  const result=await pending.promise;
  assert.equal(result.kind,'error');
  if(result.kind!=='error')return;
  assert.equal(result.error.kind,'timeout');
  assert.deepEqual(result.error.sources,['/api/catalog/klausuren']);
  assert.equal(catalogReadPresentation(result.error)?.href,undefined);
  coordinator.finish(7);
});

const settingsView=(userId='member-a',sessionContext='session-a'):SettingsView=>({
  contractVersion:1,
  account:{userId,accessGeneration:1,sessionContext},
  rows:[{kind:'theme',id:'lerntracker-theme',revision:4,payload:'indigo',editable:true,issues:[]}],
  recent:[],
});

test('R48 valid same-account settings read clears read failure and keeps local buffers',async()=>{
  const view=settingsView();let failNextRead=false;
  const client=new SettingsClient(async(_input,init)=>{
    if(init?.method==='POST')throw Error('unexpected write');
    if(failNextRead){failNextRead=false;return response(503,{error:{message:'temporary read failure'}});}
    return response(200,view);
  });
  await client.load();
  client.edit(view.rows[0],'value','forest');
  failNextRead=true;await client.load(true);
  assert.equal(client.state.hidden,true);
  assert.equal(client.state.message,'temporary read failure');
  await client.load(true);
  assert.equal(client.state.hidden,false);
  assert.equal(client.state.message,'Noch nicht gespeichert.');
  assert.deepEqual(client.state.buffers[JSON.stringify(['theme','lerntracker-theme'])].patch,{value:'forest'});
});

test('R48 valid same-account settings read keeps an uncertain receipt without resending',async()=>{
  const view=settingsView();let failNextRead=false,posts=0;
  const client=new SettingsClient(async(_input,init)=>{
    if(init?.method==='POST'){posts++;throw Error('write response lost');}
    if(failNextRead){failNextRead=false;return response(503,{error:{message:'temporary read failure'}});}
    return response(200,view);
  });
  await client.load();
  client.edit(view.rows[0],'value','forest');
  await client.save(view.rows[0]);
  assert.equal(client.state.uncertain,true);
  failNextRead=true;await client.load(true);
  assert.equal(client.state.message,'temporary read failure');
  await client.load(true);
  assert.equal(client.state.message,'Abschluss offen. Bitte Vorgangsstatus prüfen.');
  assert.equal(client.state.uncertain,true);
  assert.equal(posts,1);
});
