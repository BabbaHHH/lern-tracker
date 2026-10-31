"""Reconstruct only this task's six existing-file edits in memory, verify baseline, never revert files."""
from pathlib import Path
import json,hashlib,difflib
base=Path('docs/entwuerfe/DATA-01/pruefungen');before=json.loads((base/'data-c5b-source-before.json').read_text());proof=json.loads((base/'data-c5b-source-final.json').read_text());diff=[]
for name in proof['changed']:
    now=Path(name).read_text();old=now
    if name.endswith('account-profile-page.tsx'):
        old=old.replace('<Link href="/konto/einstellungen" className="block mt-3 underline">Meine Einstellungen</Link>','')
    elif name.endswith('account-learning-boundary.tsx'):
        old=old.replace("\nimport {AccountSettingsProvider} from './account-settings-provider';",'').replace(':<AccountSettingsProvider><AccountWritingProvider>',':<AccountWritingProvider>').replace('</AccountWritingProvider></AccountSettingsProvider>','</AccountWritingProvider>').replace('<Link href="/konto/einstellungen">Einstellungen</Link>','')
    elif name.endswith('/runtime.ts'):
        old=old.split('\nexport async function settingsRuntime')[0]
    elif name.endswith('/plan-service.ts'):
        old=old.replace("\nimport {incrementPlanMetric} from './settings-metrics';",'').replace("applied.before_values.filter(v=>!['plan-history','ai-metrics'].includes(v.after.kind))","applied.before_values.filter(v=>v.after.kind!=='plan-history')").replace("   if(op.type==='apply'||op.type==='undo'){this.faults.beforeWrite?.(writeIndex++);changes.push(await incrementPlanMetric(c,a.userId,op.type==='apply'?'plansApplied':'plansUndone'));}\n",'')
    elif name.endswith('/correction-context.ts'):
        old=old.replace('AI_DEFAULTS,isReasoningPreference,','AI_DEFAULTS,MODEL_REASONING,isReasoningPreference,').replace("const rr=s.rows.filter(r=>r.kind==='reasoning-settings'&&r.id==='lerntracker-ai-reasoning');","const rr=s.rows.filter(r=>r.kind==='reasoning-settings');")
        old=old.replace("if(rr.length>1||rr.some(r=>!object(r.payload)||(Object.hasOwn(r.payload,settings.model)&&(!isReasoningPreference(r.payload[settings.model])||!supportsReasoning(settings.model,r.payload[settings.model] as ReasoningPreference)))))issues.push('Der verwendete persönliche Denkaufwand ist ungültig. Unbeteiligte Altwerte bleiben erhalten.');","if(rr.length>1||rr.some(r=>r.id!=='lerntracker-ai-reasoning'||!object(r.payload)||Object.entries(r.payload).some(([m,v])=>!Object.hasOwn(MODEL_REASONING,m)||!isReasoningPreference(v)||!supportsReasoning(m,v))))issues.push('Gespeicherte Reasoningdaten sind ungültig.');")
    elif name.endswith('/checkin-context.ts'):
        old=old.replace('AI_DEFAULTS,isReasoningPreference,','AI_DEFAULTS,MODEL_REASONING,isReasoningPreference,').replace("for(const row of prompts.filter(r=>r.id==='checkin')){if(","for(const row of prompts){if(!DEFAULT_PROMPTS.some(p=>p.id===row.id)||").replace("const settings=rows.filter(r=>r.kind==='reasoning-settings'&&r.id==='lerntracker-ai-reasoning');","const settings=rows.filter(r=>r.kind==='reasoning-settings');")
        old=old.replace("const selected=reasoning[AI_DEFAULTS.cheap.id];if(Object.hasOwn(reasoning,AI_DEFAULTS.cheap.id)&&(!isReasoningPreference(selected)||!supportsReasoning(AI_DEFAULTS.cheap.id,selected)))invalid();","for(const [model,value] of Object.entries(reasoning))if(!Object.hasOwn(MODEL_REASONING,model)||!isReasoningPreference(value)||!supportsReasoning(model,value))invalid();")
    else:raise Exception('Unexpected shared file '+name)
    assert hashlib.sha256(old.encode()).hexdigest()==before[name],name
    diff.extend(difflib.unified_diff(old.splitlines(True),now.splitlines(True),fromfile='before/'+name,tofile='after/'+name))
(base/'data-c5b-shared.diff').write_text(''.join(diff));print('Six existing file changes reconstructed exactly against original baseline.')
