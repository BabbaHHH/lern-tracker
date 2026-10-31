import {DEFAULT_PROMPTS,plain,type SettingRow} from '@/lib/learning/settings-contract';
import type {SystemPrompt} from '@/lib/prompts';
/** Display malformed legacy fields safely. Only consciously edited fields are submitted. */
export function accountPrompt(row:SettingRow,payload:unknown=row.payload):SystemPrompt|null{
 const def=DEFAULT_PROMPTS.find(p=>p.id===row.id);if(!def)return null;
 const p=plain(payload)?payload:{};
 return {...def,prompt:!Object.hasOwn(p,'prompt')?def.prompt:typeof p.prompt==='string'?p.prompt:'',modelTier:['cheap','strong','premium'].includes(String(p.modelTier))?p.modelTier as SystemPrompt['modelTier']:def.modelTier,contextFlags:!Object.hasOwn(p,'contextFlags')?def.contextFlags:Array.isArray(p.contextFlags)?p.contextFlags.filter((v):v is SystemPrompt['contextFlags'][number]=>typeof v==='string'):[]};
}
