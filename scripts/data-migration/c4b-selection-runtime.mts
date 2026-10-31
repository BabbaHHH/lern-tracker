import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createInterface} from 'node:readline';
const proof=resolve('docs/entwuerfe/DATA-01/pruefungen'),{root}=JSON.parse(await readFile(join(proof,'data-c4b-selection-copy.json'),'utf8'));
if(!/^\/private\/tmp\/stex-c4b-selection-[a-zA-Z0-9]+$/.test(root))throw Error('Own selection QA copy required');
const socket=createServer();await new Promise<void>(r=>socket.listen(0,'127.0.0.1',r));const address=socket.address();if(!address||typeof address==='string')throw Error('port');const port=address.port;await new Promise<void>(r=>socket.close(()=>r()));
const next=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',STEX_AUTH_MODE:'off',STEX_LEARNING_MODE:'browser',STEX_ISOLATED_DEV:'1'},detached:true,stdio:['ignore','inherit','inherit']});
await writeFile(join(proof,'data-c4b-selection-runtime.json'),JSON.stringify({root,port,url:`http://localhost:${port}/c4b-selection-qa`,parentPid:process.pid,nextPid:next.pid,database:false,provider:false},null,2)+'\n');console.log(JSON.stringify({port,root}));
let stopping=false;async function stop(){if(stopping)return;stopping=true;if(next.exitCode===null&&next.signalCode===null){process.kill(-next.pid!,'SIGTERM');await new Promise<void>(r=>next.once('exit',()=>r()));}console.log('Selection QA runtime stopped');process.exit(0);}
createInterface({input:process.stdin}).on('line',line=>{if(line==='stop')void stop();});process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
