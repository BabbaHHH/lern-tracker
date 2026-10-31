/** Pure adapter of the existing focus/window rules; no browser reader is imported. */
import type {KorrekturGranularity,KlausurFeedback,FehlerMarker,FehlerProfil} from '../types';
type FeedbackScope=KlausurFeedback['scope'];
export const MARKER_SENTINEL='---MARKER-JSON---';
export interface FocusResult {
  scope: FeedbackScope;
  /** Der tatsächlich zu bewertende Text. */
  focus: string;
  /** Kontext DAVOR (nur Orientierung, wird nicht bewertet). */
  before: string;
  /** Kontext DANACH (nur bei manueller Auswahl). */
  after: string;
  /** Hinweis an die KI, wie scharf/umfangreich die Kritik sein soll. */
  granularityHint: string;
}

// Zeichen-Budgets je Granularität (siehe Plan-Payload-Tabelle).
const BUDGET = {
  wort: { before: 400 },
  satz: { before: 800 },
  absatz: { before: 1200 },
  auswahl: { before: 800, after: 400 },
} as const;

function clampEnd(s: string, max: number): string {
  // letzte `max` Zeichen, an Wortgrenze sauber abgeschnitten
  if (s.length <= max) return s.trim();
  const cut = s.slice(s.length - max);
  const sp = cut.indexOf(" ");
  return (sp > 0 ? cut.slice(sp + 1) : cut).trim();
}

function clampStart(s: string, max: number): string {
  if (s.length <= max) return s.trim();
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut).trim();
}

function splitSentences(s: string): string[] {
  return (s.match(/[^.!?]+[.!?]+["»')\]]*\s*/g) ?? []).map((x) => x.trim()).filter(Boolean);
}

function splitParagraphs(s: string): string[] {
  return s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export interface CorrectionSelectionRange {start:number;end:number}
/** Map the editor's exact serialization, never search for matching wording. */
export function confirmedSelectionRange(
  confirmedText:string,
  serialized:{full:string;prefix:string;through:string;selected:string},
):CorrectionSelectionRange|null {
  const {full,prefix,through,selected}=serialized;
  if(full!==confirmedText||!full.startsWith(prefix)||!full.startsWith(through)||!through.startsWith(prefix))return null;
  const start=prefix.length,end=through.length;
  if(full.slice(start,end)!==selected)return null;
  return {start,end};
}

/** Explicit stored-text bounds determine both focus and its surrounding windows. */
export function selectionFocus(text:string,range:CorrectionSelectionRange):FocusResult|null {
  const {start,end}=range;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>text.length)return null;
  const raw=text.slice(start,end),focus=raw.trim();if(!focus)return null;
  const focusStart=start+raw.length-raw.trimStart().length,focusEnd=focusStart+focus.length;
  return {scope:'abschnitt',focus,before:clampEnd(text.slice(0,focusStart),BUDGET.auswahl.before),after:clampStart(text.slice(focusEnd),BUDGET.auswahl.after),granularityHint:'Abschnitts-Korrektur des markierten Texts.'};
}

/**
 * Bestimmt aus dem Volltext (+ optionaler Caret-Position) den zu bewertenden Fokus
 * und sein begrenztes Kontextfenster. Vorwärts-Schreibfluss: bei Live-Triggern wird
 * nur Kontext DAVOR mitgeschickt, nie nachfolgender (unfertiger) Text.
 *
 * @param text   Plaintext der Klausur
 * @param caret  Cursor-Offset (Default = Textende)
 * @param granularity  manuell | wort | satz | absatz
 * @param selection  bei "manuell": explizite Grenzen im bestätigten Text
 */
export function extractFocus(
  text: string,
  caret: number | null,
  granularity: KorrekturGranularity,
  selection?: CorrectionSelectionRange,
): FocusResult | null {
  const full = text ?? "";
  const pos = caret == null ? full.length : Math.max(0, Math.min(caret, full.length));

  if (granularity === "manuell") return selection?selectionFocus(full,selection):null;

  const head = full.slice(0, pos);

  if (granularity === "wort") {
    const words = head.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    const focus = words.slice(-3).join(" ");
    const ctx = head.slice(0, head.length - focus.length);
    const sentStart = Math.max(
      ctx.lastIndexOf(". "), ctx.lastIndexOf("! "), ctx.lastIndexOf("? "), ctx.lastIndexOf("\n"),
    );
    const before = clampEnd(ctx.slice(sentStart + 1), BUDGET.wort.before);
    return {
      scope: "wort",
      focus,
      before,
      after: "",
      granularityHint: "Nur Lexik / Terminologie / Tippfehler / verbotene Floskeln prüfen — knapp.",
    };
  }

  if (granularity === "satz") {
    const sentences = splitSentences(head);
    if (sentences.length === 0) return null;
    const focus = sentences[sentences.length - 1];
    const paraStart = head.lastIndexOf("\n\n");
    const paraBefore = head.slice(paraStart + 1, head.length - focus.length);
    const before = clampEnd(paraBefore, BUDGET.satz.before);
    return {
      scope: "satz",
      focus,
      before,
      after: "",
      granularityHint: "Satzbau, Stil und einzelne Formfehler dieses Satzes prüfen.",
    };
  }

  // granularity === "absatz"
  const paras = splitParagraphs(head);
  if (paras.length === 0) return null;
  const focus = paras[paras.length - 1];
  const before = paras.length > 1 ? clampEnd(paras[paras.length - 2], BUDGET.absatz.before) : "";
  return {
    scope: "absatz",
    focus,
    before,
    after: "",
    granularityHint: "Argumentations- / Subsumtionsaufbau und Kohärenz dieses Absatzes prüfen.",
  };
}

/** Fokus für ein Gesamt-Gutachten (ganze Klausur, kein Fenster nötig). */
export function gesamtFocus(text: string): FocusResult {
  return {
    scope: "gesamt",
    focus: (text ?? "").trim(),
    before: "",
    after: "",
    granularityHint: "Volle Korrektur inkl. Gesamtaufbau, Schwerpunktsetzung, Tenor/Ergebnis.",
  };
}


const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const safeKey=(v:unknown):v is string=>typeof v==='string'&&/^[a-z0-9_]{1,100}$/i.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const count=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0&&Number(v)<1000000;
const timestamp=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
export function validProfile(v:unknown):v is FehlerProfil{
 if(!object(v)||!object(v.markers)||Object.keys(v.markers).length>500||!timestamp(v.updatedAt))return false;
 return Object.entries(v.markers).every(([k,e])=>safeKey(k)&&object(e)&&typeof e.label==='string'&&!!e.label.trim()&&e.label.length<=200&&count(e.count)&&['neu','steigend','konstant','fallend'].includes(String(e.trend))&&timestamp(e.lastSeen)&&(e.byType===undefined||(object(e.byType)&&Object.entries(e.byType).length<=50&&Object.entries(e.byType).every(([t,n])=>t.length<=120&&!['__proto__','constructor','prototype'].includes(t)&&count(n)))));
}
export function parseCorrectionReply(reply:string):{prosa:string;markers:FehlerMarker[]}{
 const pieces=reply.split(MARKER_SENTINEL);if(pieces.length!==2)throw Error('Die Antwort braucht genau den vereinbarten Marker-Trenner.');
 const prosa=pieces[0].trim();if(!prosa||prosa.length>16000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(prosa))throw Error('Ungültiger Feedbacktext.');
 let raw=pieces[1].trim();if(/^```(?:json)?\s/.test(raw)&&raw.endsWith('```'))raw=raw.replace(/^```(?:json)?\s*/,'').slice(0,-3).trim();
 let v:unknown;try{v=JSON.parse(raw);}catch{throw Error('Das Marker-JSON ist ungültig.');}
 if(!object(v)||Object.keys(v).some(k=>k!=='markers')||!Array.isArray(v.markers)||v.markers.length>6)throw Error('Ungültige Markerzahl oder Markerfelder.');
 const seen=new Set<string>(),markers:FehlerMarker[]=[];
 for(const m of v.markers){if(!object(m)||Object.keys(m).some(k=>!['key','label','severity'].includes(k))||!safeKey(m.key)||seen.has(m.key)||typeof m.label!=='string'||!m.label.trim()||m.label.length>200||/[\u0000-\u001f]/.test(m.label)||(m.severity!==undefined&&!['hoch','mittel','niedrig'].includes(String(m.severity))))throw Error('Ungültiger oder doppelter Fehlermarker.');seen.add(m.key);markers.push(m as unknown as FehlerMarker);}
 return {prosa,markers};
}
/** Preserve unknown profile/entry/byType fields; one increment per validated unique response marker. */
export function mergeCorrectionMarkers(previous:FehlerProfil|null,markers:FehlerMarker[],type:string|undefined,stamp:string):FehlerProfil{
 const result={...previous,markers:{...previous?.markers},updatedAt:stamp} as FehlerProfil;
 for(const m of markers){const old=Object.hasOwn(result.markers,m.key)?result.markers[m.key]:undefined;const byType={...old?.byType} as Record<string,number>;
  if(type)byType[type]=(byType[type]??0)+1;
  result.markers[m.key]={...old,label:m.label,count:(old?.count??0)+1,trend:old?'steigend':'neu',lastSeen:stamp,byType};
 }
 if(!validProfile(result))throw Error('Das Fehlerprofil überschreitet die zulässigen Grenzen.');return result;
}
