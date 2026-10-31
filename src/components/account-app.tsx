"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { TOPICS,getLeafTopics } from "@/lib/topics";
import { notifyAccountSignedOut } from "./account-settings-provider";

interface Account {userId:string;email:string;name:string;status:string;role:string;revision:number;bootstrap:boolean}
interface Note {id:string;revision:number;value:{note:string;topicId:string}}
class AccountRequestError extends Error {constructor(message:string,readonly status:number){super(message);}}
function postLoginPath(account:Account|null):"/"|"/konto" {
  return account?.status==="active"&&!account.bootstrap?"/":"/konto";
}
const inputStyle="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const buttonStyle="rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50";
async function request(path:string,body?:unknown) {
  const response=await fetch(path,{method:body===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",
    headers:body===undefined?{}:{"Content-Type":"application/json","X-Stex-Action":"1"},body:body===undefined?undefined:JSON.stringify(body)});
  const value=await response.json();
  if(!response.ok)throw new AccountRequestError(typeof value.error==="object"?value.error.message:value.message||"Die Aktion konnte nicht ausgeführt werden.",response.status);
  return value;
}
export function AccountApp({mode="main",token="",invitedEmail=""}:{mode?:"main"|"login"|"setup"|"reset";token?:string;invitedEmail?:string}) {
  const router=useRouter();
  const loadSequence=useRef(0),shownOwner=useRef<string|null>(null);
  const [account,setAccount]=useState<Account|null>(null),[notes,setNotes]=useState<Note[]>([]);
  const [access,setAccess]=useState<"checking"|"ready"|"login"|"unavailable">(mode==="main"?"checking":"login");
  const [email,setEmail]=useState(invitedEmail),[password,setPassword]=useState(""),[code,setCode]=useState(""),[challenge,setChallenge]=useState(false),[useRecovery,setUseRecovery]=useState(false);
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[qr,setQr]=useState(""),[recovery,setRecovery]=useState<string[]>([]);
  const [note,setNote]=useState(""),[topicId,setTopicId]=useState("zr-mat-at-vertragsschluss-145ff"),[editing,setEditing]=useState<Note|null>(null);
  const load=useCallback(async():Promise<Account|null>=> {
    const sequence=++loadSequence.current;
    setAccess("checking");
    try {
      let result=await request("/api/account");
      let nextNotes:Note[]=[],notesUnavailable=false;
      if(result.account.status==="active") {
        try{nextNotes=(await request("/api/account/notes")).notes;}
        catch(error){
          // A notes failure is not proof of a lost session. Recheck actual denials.
          if(error instanceof AccountRequestError && [401,403].includes(error.status))result=await request("/api/account");
          notesUnavailable=true;
        }
      }
      if(sequence!==loadSequence.current)return null;
      if(shownOwner.current!==result.account.userId){setNote("");setEditing(null);setRecovery([]);setQr("");}
      shownOwner.current=result.account.userId;setAccount(result.account);setNotes(nextNotes);
      setAccess("ready");setMessage(notesUnavailable?"Deine Anmeldung ist bestätigt. Deine Lernnotizen sind gerade nicht verfügbar.":"");
      return result.account as Account;
    }catch(error){if(sequence!==loadSequence.current)return null;shownOwner.current=null;setNote("");setEditing(null);setRecovery([]);setQr("");setAccount(null);setNotes([]);setAccess(error instanceof AccountRequestError&&error.status===401?"login":"unavailable");setMessage(error instanceof Error?error.message:"Der Kontozugang konnte gerade nicht geprüft werden.");return null;}
  },[]);
  useEffect(()=>{
    if(mode!=="main")return;
    const timer=setTimeout(()=>void load(),0);
    const refresh=()=>{if(document.visibilityState==="visible")void load();};
    window.addEventListener("pageshow",refresh);document.addEventListener("visibilitychange",refresh);
    return()=>{clearTimeout(timer);window.removeEventListener("pageshow",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[mode,load]);
  async function act(work:()=>Promise<void>) {
    setBusy(true);setMessage("");
    try{await work();}catch(error){setMessage(error instanceof Error?error.message:"Die Aktion konnte nicht ausgeführt werden.");}finally{setBusy(false);}
  }
  async function login() {
    const result=await request("/api/auth/sign-in/email",{email,password,callbackURL:"/"});setPassword("");
    if(result.twoFactorRedirect){setChallenge(true);setMessage("Bitte den Authenticator-Code eingeben.");return;}
    const signedInAccount=await load();
    if(signedInAccount){router.replace(postLoginPath(signedInAccount));router.refresh();}
  }
  async function verifyFactor() {
    await request(useRecovery?"/api/auth/two-factor/verify-backup-code":"/api/auth/two-factor/verify-totp",{code,trustDevice:false});setCode("");setChallenge(false);setUseRecovery(false);
    if(account?.bootstrap){setQr("");setMessage("Authenticator bestätigt. Die betriebliche Admin-Einrichtung kann jetzt abgeschlossen werden.");}
    else {
      const signedInAccount=await load();
      if(signedInAccount){router.replace(postLoginPath(signedInAccount));router.refresh();}
    }
  }
  return <main className="mx-auto w-full max-w-3xl px-4 py-10 space-y-6">
    <header><p className="text-sm text-indigo-700">Stex Tracker · Persönlicher Kontobereich</p><h1 className="mt-2 text-3xl font-semibold">{mode==="setup"?"Dein Konto einrichten":mode==="reset"?"Passwort zurücksetzen":account?`Hallo ${account.name}`:access==="checking"||access==="unavailable"?"Kontozugang prüfen":"Anmelden"}</h1>
      <p className="mt-2 text-sm text-slate-600">Hier verwaltest du dein Konto. Deine persönlichen Lerndaten werden getrennt von anderen Konten gespeichert.</p></header>
    {message && <p role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">{message}</p>}
    {!account && !challenge && mode!=="reset" && access==="checking" && <p role="status">Dein Kontozugang wird geprüft …</p>}
    {!account && !challenge && mode!=="reset" && access==="unavailable" && <button className={buttonStyle} disabled={busy} onClick={()=>void act(async()=>{const checked=await load();if(checked&&mode==="login"){router.replace(postLoginPath(checked));router.refresh();}})}>Kontozugang erneut prüfen</button>}
    {!account && !challenge && mode!=="reset" && (mode==="setup"||access==="login") && <form className="space-y-4 rounded-xl border border-slate-200 p-5" onSubmit={event=>{event.preventDefault();void act(mode==="setup"?async()=>{
      await request("/api/auth/sign-up/email",{email,password,invitationToken:token});setPassword("");setMessage("Konto angelegt. Niklas stellt dir den persönlichen Bestätigungslink im Pilot separat bereit. Bestätige damit deine E-Mail-Adresse und melde dich danach an.");
    }:login);}}>
      {mode==="setup" && <p>Deine persönliche Einladung gilt für die angezeigte Adresse. Nach der Adressbestätigung schaltet Niklas dich gesondert frei.</p>}
      <label className="block">E-Mail<input className={inputStyle} type="email" required autoComplete="username" value={email} readOnly={mode==="setup"} onChange={event=>setEmail(event.target.value)}/></label>
      <label className="block">Passwort<input className={inputStyle} type="password" required minLength={mode==="setup"?15:1} maxLength={128} autoComplete={mode==="setup"?"new-password":"current-password"} value={password} onChange={event=>setPassword(event.target.value)}/></label>
      {mode==="setup" && <p className="text-sm text-slate-600">Mindestens 15 Zeichen. Du kannst einen Passwortmanager verwenden.</p>}
      <button className={buttonStyle} disabled={busy}>{mode==="setup"?"Konto einrichten":"Anmelden"}</button>
      <div className="flex flex-wrap gap-4 text-sm"><button type="button" className="underline" disabled={busy || !email} onClick={()=>void act(async()=>{await request("/api/auth/request-password-reset",{email,redirectTo:"/konto/zuruecksetzen"});setMessage("Deine Anfrage zur Passwortwiederherstellung wurde aufgenommen. Falls ein Konto vorhanden ist, stellt Niklas den persönlichen Link im Pilot separat bereit.");})}>Passwort vergessen</button>
        <button type="button" className="underline" disabled={busy || !email} onClick={()=>void act(async()=>{await request("/api/auth/send-verification-email",{email,callbackURL:"/konto"});setMessage("Deine Bestätigungsanfrage wurde aufgenommen. Falls eine Bestätigung aussteht, stellt Niklas den persönlichen Link im Pilot separat bereit.");})}>Bestätigung erneut anfordern</button>
        {mode==="setup" && <Link href="/konto/anmelden" className="underline">Zur Anmeldung</Link>}</div>
    </form>}
    {mode==="reset" && <form className="space-y-4 rounded-xl border p-5" onSubmit={event=>{event.preventDefault();void act(async()=>{await request("/api/auth/reset-password",{token,newPassword:password});setPassword("");setMessage("Passwort geändert. Bisherige Sitzungen wurden beendet. Bitte neu anmelden.");});}}>
      <label>Neues Passwort<input className={inputStyle} type="password" required minLength={15} maxLength={128} autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)}/></label><button className={buttonStyle} disabled={busy || !token}>Passwort ändern</button><Link className="ml-4 underline" href="/konto/anmelden">Zur Anmeldung</Link>
    </form>}
    {(challenge || qr) && <form className="space-y-4 rounded-xl border p-5" onSubmit={event=>{event.preventDefault();void act(verifyFactor);}}>
      {qr && <Image unoptimized src={qr} width={220} height={220} alt="QR-Code zur Einrichtung in deiner Authenticator-App"/>}
      <label className="block">{useRecovery?"Wiederherstellungscode":"Authenticator-Code"}<input className={inputStyle} required autoComplete="one-time-code" inputMode={useRecovery?"text":"numeric"} value={code} onChange={event=>setCode(event.target.value)}/></label>
      <button className={buttonStyle} disabled={busy}>Code bestätigen</button>
      {!qr && <button type="button" className="ml-4 underline" onClick={()=>{setUseRecovery(!useRecovery);setCode("");}}>{useRecovery?"Authenticator verwenden":"Handy verloren? Wiederherstellungscode verwenden"}</button>}
    </form>}
    {account && <>
      <section className="rounded-xl border border-slate-200 p-5 space-y-3"><p>{account.email} · {account.role==="admin"?"Admin":"Mitglied"}</p>
        {account.status==="active" && <Link className="inline-block underline" href="/konto/ki">KI-Zugang verwalten · eigenen OpenRouter-Schlüssel einfügen</Link>}
        {account.status==="pending" && <p role="status">Dein Konto wartet auf Niklas’ Freischaltung.</p>}
        <button className="underline" disabled={busy} onClick={()=>void act(async()=>{await request("/api/auth/sign-out",{});notifyAccountSignedOut();loadSequence.current++;shownOwner.current=null;setNote("");setEditing(null);setAccount(null);setNotes([]);setAccess("login");setRecovery([]);setQr("");router.replace("/konto/anmelden");router.refresh();})}>Abmelden</button>
      </section>
      {account.bootstrap && !qr && <section className="rounded-xl border p-5 space-y-3"><h2 className="text-xl font-medium">Adminzugang vorbereiten</h2><p>Richte deinen Authenticator ein und sichere die Wiederherstellungscodes außerhalb der Website.</p>
        <label className="block">Passwort bestätigen<input className={inputStyle} type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/></label>
        <button className={buttonStyle} disabled={busy || !password} onClick={()=>void act(async()=>{const result=await request("/api/auth/two-factor/enable",{password,method:"totp"});setPassword("");setRecovery(result.backupCodes);setQr(await QRCode.toDataURL(result.totpURI));})}>Authenticator einrichten</button>
      </section>}
      {recovery.length>0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-medium">Wiederherstellungscodes jetzt sicher aufbewahren</h2><ul className="mt-3 font-mono">{recovery.map(value=><li key={value}>{value}</li>)}</ul><button className="mt-3 underline" onClick={()=>setRecovery([])}>Codes sind gesichert · ausblenden</button></section>}
      {account.status==="active" && <section className="space-y-4 rounded-xl border p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-medium">Meine Lernnotizen</h2><div className="flex gap-3"><Link className="text-sm underline" href="/konto/klausuren">Gemeinsame Klausuren</Link><Link className="text-sm underline" href="/konto/klausuren/suche">Klausuren durchsuchen</Link></div></div>
        <form className="space-y-3" onSubmit={event=>{event.preventDefault();void act(async()=>{
          await request("/api/account/notes",{id:editing?.id??crypto.randomUUID(),topicId,note,expectedRevision:editing?.revision??null});setNote("");setEditing(null);await load();setMessage("Deine Lernnotiz wurde gespeichert.");
        });}}><label className="block">Thema<select className={inputStyle} value={topicId} onChange={event=>setTopicId(event.target.value)}>{getLeafTopics(TOPICS).map(topic=><option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
          <label className="block">Lernnotiz<textarea className={inputStyle} rows={4} required maxLength={10000} value={note} onChange={event=>setNote(event.target.value)}/></label><button className={buttonStyle} disabled={busy}>Lernnotiz speichern</button></form>
        <ul className="space-y-3">{notes.map(item=><li key={item.id} className="rounded-lg bg-slate-50 p-3"><p className="text-sm text-slate-500">{TOPICS.find(topic=>topic.id===item.value.topicId)?.label}</p><p className="whitespace-pre-wrap">{item.value.note}</p><button className="mt-2 text-sm underline" onClick={()=>{setEditing(item);setNote(item.value.note);setTopicId(item.value.topicId);}}>Bearbeiten</button></li>)}</ul>
        <button className="text-sm underline" onClick={()=>void act(async()=>{await load();})}>Neu laden</button>
      </section>}
      {account.role==="admin" && account.status==="active" && <section className="rounded-xl border p-5"><h2 className="text-xl font-medium">Verwaltung</h2><Link className="mt-3 inline-block underline" href="/konto/verwaltung">Konten, Importe und Betriebsfehler verwalten</Link></section>}
    </>}
  </main>;
}
