import type { LearningAccount, ProgressRecord } from './progress-contract';
export interface CheckinMessage { role:'user'|'assistant'; content:string }
export interface CheckinSuggestion { topicId:string; percent:number; beforePercent:number; expectedRevision:number|null }
export interface CheckinBase { contractVersion:1; expectedAccountId:string; expectedAccessGeneration:number; expectedSessionContext:string }
export interface CheckinAsk extends CheckinBase { action:'ask'; requestId:string; snapshot:string; messages:CheckinMessage[] }
export interface CheckinApply extends CheckinBase { action:'apply'; requestId:string; proposalId:string }
export type CheckinCommand=CheckinAsk|CheckinApply;
export interface CheckinResult {
 contractVersion:1; account:LearningAccount; requestId:string; action:'checkin'; operation:'ask'|'apply';
 state:'pending'|'ready'|'failed'|'applied'|'stale'; snapshot:string; createdAt:string;
 message:string; suggestions:CheckinSuggestion[]; progress:ProgressRecord[]; replay:boolean;
 proposalId?:string; errorCode?:string;
}
export interface CheckinView {
 contractVersion:1; account:LearningAccount; snapshot:string; today:string;
 settings:{model:string;promptDefault:boolean;reasoningDefault:boolean};
 recent:CheckinResult[];
}
