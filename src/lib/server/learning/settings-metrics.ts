import type {PoolClient} from 'pg';
import {recordKey} from '../../data-migration/migration';
import {plain} from '../../learning/settings-contract';
import {AccountError} from '../auth/security';
import type {PlanRow} from './plan-calculation';
/** Caller holds lockState in the same plan transaction. Never used by reads/replay. */
export async function incrementPlanMetric(c:PoolClient,owner:string,field:'plansApplied'|'plansUndone'){
 const id='lerntracker-ai-metrics',key=recordKey('ai-metrics',owner,id);
 const before=(await c.query<PlanRow>('SELECT kind,id,revision,payload,normalized,legacy_key AS "legacyKey" FROM stex.personal_records WHERE record_key=$1',[key])).rows[0]??null;
 if(before&&(!plain(before.payload)||before.normalized.c3aDeleted))throw new AccountError('invalid_context','Gespeicherte Planaktionszähler brauchen Klärung.',409);
 const payload=before?before.payload as Record<string,unknown>:{},old=Object.hasOwn(payload,field)?payload[field]:0;
 if(!Number.isSafeInteger(old)||Number(old)<0||Number(old)>=Number.MAX_SAFE_INTEGER)throw new AccountError('invalid_context','Der betroffene Planaktionszähler ist ungültig; keine Teilübernahme.',409);
 const after=(await c.query<PlanRow>(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized) VALUES($1,$2,'ai-metrics',$3,1,$3,$4::jsonb,$5::jsonb) ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,revision=personal_records.revision+1 WHERE personal_records.revision=$6 RETURNING kind,id,revision,payload,normalized,legacy_key AS "legacyKey"`,[key,owner,id,JSON.stringify({...payload,[field]:Number(old)+1}),JSON.stringify(before?.normalized??{}),before?.revision??null])).rows[0];
 if(!after)throw new AccountError('conflict','Zählerstand hat sich geändert.',409);
 const refs=(await c.query('SELECT * FROM stex.record_references WHERE source_key=$1 ORDER BY source_key,path',[key])).rows;
 return {before,after,beforeReferences:refs,afterReferences:refs};
}
