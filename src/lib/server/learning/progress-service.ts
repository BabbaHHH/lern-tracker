import type { PoolClient } from "pg";
import { TOPICS, getLeafTopics } from "../../topics";
import { digest, recordKey } from "../../data-migration/migration";
import type { Progress } from "../../types";
import type { LearningAccount, ProgressCommand, ProgressRecord, ProgressResult, ProgressView } from "../../learning/progress-contract";
import type { AccountService } from "../auth/service";
import { AccountError, exactFields } from "../auth/security";
import { lockState } from "../persistence/repository";

const leafIds = new Set(getLeafTopics(TOPICS).map(t => t.id));
const topicsVersion = digest([...leafIds].sort());
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const object = (value: unknown): value is Record<string,unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
interface Receipt { fingerprint: string; before_values: {topicId:string;percent:number}[]; result: ProgressResult; action: "set"|"undo" }
// Equality marker only: never expose a session ID/token, and never accept this as authentication.
const accountContext = (who:{userId:string;generation:number;sessionId:string}):LearningAccount => ({userId:who.userId,accessGeneration:who.generation,sessionContext:digest(["learning-session",who.sessionId])});
export function validateProgressCommand(input: unknown): ProgressCommand {
  if (!object(input)) throw new AccountError("invalid_input","Ungültige Lernaktion.");
  exactFields(input,input.action === "set" ? ["contractVersion","requestId","expectedAccountId","expectedAccessGeneration","expectedSessionContext","action","changes"] : ["contractVersion","requestId","expectedAccountId","expectedAccessGeneration","expectedSessionContext","action","undoOfRequestId"]);
  if (input.contractVersion !== 1 || !validId(input.requestId) || typeof input.expectedAccountId !== "string" || !input.expectedAccountId
    || !Number.isSafeInteger(input.expectedAccessGeneration) || Number(input.expectedAccessGeneration)<1 || typeof input.expectedSessionContext!=="string" || !/^[0-9a-f]{64}$/.test(input.expectedSessionContext)) throw new AccountError("invalid_input","Konto- und Vorgangsstand fehlen.");
  if (input.action === "undo") {
    if (!validId(input.undoOfRequestId) || input.undoOfRequestId === input.requestId) throw new AccountError("invalid_input","Ungültiger Rückgängig-Bezug.");
  } else if (input.action === "set") {
    if (!Array.isArray(input.changes) || !input.changes.length || input.changes.length > leafIds.size) throw new AccountError("invalid_input","Ungültige Themenauswahl.");
    const seen = new Set<string>();
    for (const change of input.changes) {
      if (!object(change)) throw new AccountError("invalid_input","Ungültige Themenänderung.");
      exactFields(change,["topicId","percent","expectedRevision"]);
      if (typeof change.topicId !== "string" || !leafIds.has(change.topicId) || seen.has(change.topicId) || !Number.isInteger(change.percent)
        || Number(change.percent)<0 || Number(change.percent)>100 || (change.expectedRevision !== null && (!Number.isSafeInteger(change.expectedRevision) || Number(change.expectedRevision)<1))) throw new AccountError("invalid_input","Thema, Prozentwert oder Revision ist ungültig.");
      seen.add(change.topicId);
    }
  } else throw new AccountError("invalid_input","Unbekannte Lernaktion.");
  return input as unknown as ProgressCommand;
}
export class ProgressService {
  constructor(readonly auth: AccountService, private readonly faults: {beforeTransaction?:()=>Promise<void>;beforeWrite?:(index:number)=>void;beforeCommit?:()=>void} = {}) {}
  private async receipt(client:PoolClient,owner:string,id:string):Promise<Receipt|undefined> {
    return (await client.query<Receipt>("SELECT fingerprint,before_values,result,action FROM stex.learning_commands WHERE owner_user_id=$1 AND request_id=$2",[owner,id])).rows[0];
  }
  async read(headers:Headers):Promise<ProgressView> {
    const who = await this.auth.principal(headers);
    return this.auth.database.transaction(async client => {
      const current = await this.auth.checkPrincipal(client,who.sessionId,"active",false,true);
      const rows = await client.query<{id:string;value:Progress;revision:number}>("SELECT id,payload AS value,revision FROM stex.personal_records WHERE owner_user_id=$1 AND kind='progress' ORDER BY id",[current.userId]);
      return {contractVersion:1,account:accountContext(current),topicsVersion,progress:rows.rows};
    });
  }
  async status(headers:Headers,id:string):Promise<ProgressResult> {
    if (!validId(id)) throw new AccountError("invalid_input","Ungültige Vorgangskennung.");
    const who = await this.auth.principal(headers);
    return this.auth.database.transaction(async client => {
      const current = await this.auth.checkPrincipal(client,who.sessionId,"active",false,true);
      const previous = await this.receipt(client,current.userId,id);
      if (!previous || !["set","undo"].includes(previous.action)) throw new AccountError("not_found","Lernaktion nicht gefunden.",404);
      return {...previous.result,account:accountContext(current),replay:true};
    });
  }
  async submit(headers:Headers,input:unknown):Promise<ProgressResult> {
    const command = validateProgressCommand(input);
    const who = await this.auth.principal(headers);
    await this.faults.beforeTransaction?.();
    return this.auth.database.transaction(async client => {
      await lockState(client);
      const current = await this.auth.checkPrincipal(client,who.sessionId,"active",false,true);
      const account = accountContext(current);
      if (command.expectedAccountId !== account.userId || command.expectedAccessGeneration !== account.accessGeneration || command.expectedSessionContext!==account.sessionContext) throw new AccountError("account_changed","Das Konto oder die Anmeldung hat sich geändert. Bitte neu laden.",409);
      // Access generation is a separately checked precondition, not part of the semantic action.
      const {expectedAccessGeneration: _generation,expectedSessionContext:_session,...semantic} = command;
      void _generation;void _session;
      const fingerprint = digest(semantic);
      const replay = await this.receipt(client,current.userId,command.requestId);
      if (replay) {
        if (replay.fingerprint !== fingerprint) throw new AccountError("conflict","Diese Vorgangskennung gehört zu einer anderen Änderung.",409);
        return {...replay.result,account,replay:true};
      }
      let changes: {topicId:string;percent:number;expectedRevision:number|null}[];
      if (command.action === "set") changes = command.changes;
      else {
        const original = await this.receipt(client,current.userId,command.undoOfRequestId);
        if (!original || original.action !== "set") throw new AccountError("not_found","Gruppenaktion nicht gefunden.",404);
        changes = original.before_values.map(before => ({...before,expectedRevision:original.result.progress.find(r => r.id === before.topicId)!.revision}));
      }
      const beforeValues: Receipt["before_values"] = [];
      const progress: ProgressRecord[] = [];
      const stamp = new Date().toISOString();
      for (let index=0;index<changes.length;index++) {
        const change = changes[index];
        this.faults.beforeWrite?.(index);
        const key = recordKey("progress",current.userId,change.topicId);
        const existing = (await client.query<{revision:number;payload:Progress}>("SELECT revision,payload FROM stex.personal_records WHERE record_key=$1",[key])).rows[0];
        if ((existing?.revision ?? null) !== change.expectedRevision) throw new AccountError("conflict","Der Lernstand wurde inzwischen geändert. Bitte neu laden.",409);
        beforeValues.push({topicId:change.topicId,percent:existing?.payload.percent ?? 0});
        const value: Progress = {topicId:change.topicId,percent:change.percent,source:"manual",updatedAt:stamp};
        await client.query("INSERT INTO stex.topics(id) VALUES($1) ON CONFLICT DO NOTHING",[change.topicId]);
        await client.query(`INSERT INTO stex.personal_records(record_key,owner_user_id,kind,id,revision,legacy_key,payload,normalized)
          VALUES($1,$2,'progress',$3,1,'lerntracker-progress',$4::jsonb,'{}')
          ON CONFLICT(record_key) DO UPDATE SET payload=EXCLUDED.payload,revision=personal_records.revision+1`,[key,current.userId,change.topicId,JSON.stringify(value)]);
        await client.query("INSERT INTO stex.record_references(source_key,path,owner_user_id,source_personal_key,target_topic_id) VALUES($1,'value.topicId',$2,$1,$3) ON CONFLICT(source_key,path) DO NOTHING",[key,current.userId,change.topicId]);
        progress.push({id:change.topicId,value,revision:(existing?.revision ?? 0)+1});
      }
      const result: ProgressResult = {contractVersion:1,account,requestId:command.requestId,action:command.action,progress,replay:false};
      await client.query("INSERT INTO stex.learning_commands(owner_user_id,request_id,contract_version,action,fingerprint,before_values,result) VALUES($1,$2,1,$3,$4,$5::jsonb,$6::jsonb)",[current.userId,command.requestId,command.action,fingerprint,JSON.stringify(beforeValues),JSON.stringify(result)]);
      await client.query("UPDATE stex.state SET generation=generation+1 WHERE singleton");
      this.faults.beforeCommit?.();
      return result;
    });
  }
}
