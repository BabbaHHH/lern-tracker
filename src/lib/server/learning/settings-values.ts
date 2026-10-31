import {CONTEXT_FLAGS,DEFAULT_WEIGHTS,METRIC_FIELDS,THEMES,PLAN_MODELS,MODEL_REASONING,DEFAULT_PROMPTS,plain,settingDefault,settingFields,type SettingKind} from '../../learning/settings-contract';
import {isReasoningPreference,supportsReasoning,defaultReasoning} from '../../ai-config';
import {AccountError} from '../auth/security';
function invalid(m='Ungültige Einstellung.'):never{throw new AccountError('invalid_input',m,400);}
export function validateSettingPatch(kind:SettingKind,patch:unknown):asserts patch is Record<string,unknown>{
 if(!plain(patch)||!Object.keys(patch).length||Object.keys(patch).some(k=>!settingFields(kind).includes(k)))invalid();
 for(const [field,v] of Object.entries(patch)){
  if(kind==='recommender-settings'&&(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>10000))invalid('Gewichte müssen endliche Zahlen zwischen −10000 und 10000 sein.');
  if(kind==='theme'&&!THEMES.some(t=>t.id===v))invalid('Bitte ein vorhandenes Farbschema wählen.');
  if(kind==='plan-model'&&!PLAN_MODELS.some(m=>m.id===v))invalid('Bitte ein lokal verfügbares Planmodell wählen.');
  if(kind==='reasoning-settings'&&(!isReasoningPreference(v)||!supportsReasoning(field,v)))invalid('Der Denkaufwand passt nicht zum lokalen Modell.');
  if(kind==='prompt'){
   if(field==='prompt'&&(typeof v!=='string'||!v.trim()||v.length>32000))invalid('Prompttext muss zwischen 1 und 32000 Zeichen lang sein.');
   if(field==='modelTier'&&!['cheap','strong','premium'].includes(String(v)))invalid('Ungültige Modellstufe.');
   if(field==='contextFlags'&&(!Array.isArray(v)||v.length>CONTEXT_FLAGS.length||v.some(x=>!CONTEXT_FLAGS.includes(x as never))||new Set(v).size!==v.length))invalid('Ungültige Kontextauswahl.');
  }
 }
}
export function mergeSetting(kind:SettingKind,id:string,old:unknown,exists:boolean,operation:'patch'|'reset',patch?:Record<string,unknown>):unknown{
 const def=settingDefault(kind,id);
 if(kind==='theme'||kind==='plan-model')return operation==='reset'?def:patch!.value;
 if(exists&&!plain(old))throw new AccountError('invalid_context','Das Altformat ist kein Objekt. Es bleibt unverändert; bitte vor einer Bearbeitung klären.',409);
 const base=exists?old as Record<string,unknown>:kind==='prompt'?{...def as Record<string,unknown>}:{};
 const changes=operation==='patch'?patch!:kind==='reasoning-settings'?Object.fromEntries(Object.keys(MODEL_REASONING).map(k=>[k,defaultReasoning(k)??'provider'])):Object.fromEntries(settingFields(kind).map(k=>[k,(def as Record<string,unknown>)[k]]));
 const next={...base,...changes};
 if(kind==='prompt'&&Object.hasOwn(changes,'contextFlags')){
  const unknown=Array.isArray(base.contextFlags)?base.contextFlags.filter(f=>!CONTEXT_FLAGS.includes(f as never)):[];
  next.contextFlags=[...changes.contextFlags as unknown[],...unknown];
 }
 return next;
}
export function settingIssues(kind:SettingKind,id:string,payload:unknown):string[]{
 const issues:string[]=[];
 if(kind==='theme'||kind==='plan-model'){try{validateSettingPatch(kind,{value:payload});}catch{issues.push('Unbekannter oder ungültiger Altwert bleibt erhalten und wird nicht verwendet.');}return issues;}
 if(!plain(payload))return ['Altformat ist kein Objekt; es bleibt zur Klärung unverändert.'];
 const fields=kind==='ai-metrics'?METRIC_FIELDS:settingFields(kind);
 for(const [k,v] of Object.entries(payload)){
  if(!fields.includes(k as never)){if(kind==='prompt'&&['id','label','description'].includes(k))continue;issues.push(`Nicht bearbeiteter Altwert bleibt erhalten: ${k}`);continue;}
  if(kind==='ai-metrics'){if(!Number.isSafeInteger(v)||Number(v)<0)issues.push(`Ungültiger Zähler bleibt erhalten: ${k}`);continue;}
  try{validateSettingPatch(kind,{[k]:v});}catch{issues.push(`Ungültiger Altwert bleibt bis zur bewussten Änderung erhalten: ${k}`);}
 }
 if(kind==='prompt'){
  const def=DEFAULT_PROMPTS.find(p=>p.id===id);
  if(id==='checkin')issues.push('Check-in bleibt auf seiner bisherigen Modellstufe und seinem fest begrenzten Kontokontext; diese Auswahl erweitert ihn nicht.');
  else if(id.startsWith('korrektur-'))issues.push('Korrektur unterstützt weiterhin nur ihre bisherige Modellstufe und als optionalen Kontext das Fehlerprofil. Weitere Flags schließen den Aufruf.');
  else if(def)issues.push('Dieser KI-Verbraucher ist im Konto noch geschlossen. Speichern startet keinen Aufruf.');
 }
 if(kind==='recommender-settings'&&Object.keys(DEFAULT_WEIGHTS).some(k=>!Object.hasOwn(payload,k)))issues.push('Fehlende Gewichte erscheinen nur als ungespeicherte Vorgaben.');
 return issues;
}
