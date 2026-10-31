"use client";
import {useAccountSettings} from "@/lib/learning/use-account-settings";
import {settingsAccountKey,settingKey} from "@/lib/learning/settings-contract";
import {accountPrompt} from "./account-settings-model";
import {OriginalPromptGear,type PromptGearProps} from "./prompt-gear";
export function AccountSettingsPromptGear(props:PromptGearProps){
 const s=useAccountSettings(),row=s.hidden?undefined:s.view?.rows.find(r=>r.kind==='prompt'&&r.id===props.promptId);
 const key=row?settingKey(row):'',pending=!!s.buffers[key];
 return <OriginalPromptGear key={s.view?settingsAccountKey(s.view.account):'closed'} {...props} remote={{disabled:s.hidden||s.busy||s.uncertain||!row?.editable||pending,status:<div role="status" className="text-xs"><p>{s.message}</p>{pending&&<p>Ein unbestätigter Promptpuffer liegt vor. Bitte in den Einstellungen klären.</p>}{s.uncertain&&<button className="underline" onClick={()=>void s.client.recover()}>Vorgangsstatus prüfen</button>}{s.canRetry&&<button className="underline" onClick={()=>void s.client.retry()}>Denselben Auftrag erneut senden</button>}</div>,open:()=>{
  if(!row||!s.view||s.hidden||s.busy||s.uncertain||pending)return null;
  const captured=row,account=settingsAccountKey(s.view.account),prompt=accountPrompt(row);if(!prompt)return null;
  const matches=()=>{const current=s.client.getSnapshot();return !current.hidden&&!current.busy&&!current.uncertain&&current.view&&settingsAccountKey(current.view.account)===account&&!current.buffers[key]&&current.view.rows.find(r=>settingKey(r)===key)?.revision===captured.revision;};
  const confirmed=()=>{const current=s.client.getSnapshot();return !current.hidden&&!current.uncertain&&!current.buffers[key]&&!!current.view&&settingsAccountKey(current.view.account)===account&&current.view.rows.find(r=>settingKey(r)===key)?.revision!==captured.revision;};
  return {prompt,save:async text=>{if(!matches())return false;s.client.edit(captured,'prompt',text);await s.client.save(captured);return confirmed();},reset:async()=>{if(!matches())return false;await s.client.save(captured,true);return confirmed();}};
 }}}/>;
}
