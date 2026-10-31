'use client';
import Link from 'next/link';
export function AccountPersonalStatus({status,message,uncertain,reload,recover}:{status:string;message:string;uncertain:boolean;reload:()=>void;recover:()=>void}){
  return <div className="rounded border p-4 my-4" role={status==='error'?'alert':'status'}><p>{status==='loading'?'Lerndaten werden geprüft …':message||'Lerndaten geladen'}</p>{status==='error'&&<div className="flex gap-4 mt-3"><button className="underline" onClick={uncertain?recover:reload}>{uncertain?'Ergebnis prüfen':'Neu laden'}</button><Link className="underline" href="/konto/anmelden">Bitte neu anmelden</Link></div>}</div>;
}
