import type {LearningAccount} from './progress-contract';
import {DEFAULT_WEIGHTS,WEIGHT_LABELS,THEMES} from '../store';
import {DEFAULT_PROMPTS} from '../prompts';
import {AI_DEFAULTS,MODEL_REASONING} from '../ai-config';
import {PLAN_MODELS,DEFAULT_PLAN_MODEL} from '../ai-models';
export {DEFAULT_WEIGHTS,WEIGHT_LABELS,THEMES,DEFAULT_PROMPTS,AI_DEFAULTS,MODEL_REASONING,PLAN_MODELS,DEFAULT_PLAN_MODEL};
export const SETTINGS_KEYS={'recommender-settings':'lerntracker-recommender-weights',theme:'lerntracker-theme',prompt:'lerntracker-prompts','plan-model':'lerntracker-plan-model','reasoning-settings':'lerntracker-ai-reasoning','ai-metrics':'lerntracker-ai-metrics'} as const;
export type SettingKind=keyof typeof SETTINGS_KEYS;
export const METRIC_FIELDS=['proposalsAccepted','proposalsRejected','plansApplied','plansUndone'] as const;
export const CONTEXT_FLAGS=['timeStatus','progress','tracking','tasks','tasksUnreviewed','learningNotes','selfAssessment','calendar','onboarding','dailyBudget','klausuren','docs','topics','agWeeks','fehlerprofil'] as const;
export interface SettingRow {kind:SettingKind;id:string;revision:number|null;payload:unknown;editable:boolean;issues:string[]}
export interface SettingsView {contractVersion:1;account:LearningAccount;rows:SettingRow[];recent:{requestId:string;createdAt:string}[]}
export interface SettingsCommand {contractVersion:1;action:'settings';requestId:string;expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string;kind:SettingKind;id:string;expectedRevision:number|null;operation:'patch'|'reset';patch?:Record<string,unknown>}
export interface SettingsResult {contractVersion:1;requestId:string;account:LearningAccount;view:SettingsView;replay:boolean}
export const settingsAccountKey=(a:LearningAccount)=>JSON.stringify([a.userId,a.accessGeneration,a.sessionContext]);
export const settingKey=(r:Pick<SettingRow,'kind'|'id'>)=>JSON.stringify([r.kind,r.id]);
export const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function settingDefault(kind:SettingKind,id:string):unknown {if(kind==='prompt')return DEFAULT_PROMPTS.find(p=>p.id===id)??null;if(kind==='recommender-settings')return DEFAULT_WEIGHTS;if(kind==='theme')return 'indigo';if(kind==='plan-model')return DEFAULT_PLAN_MODEL;if(kind==='reasoning-settings')return {};return Object.fromEntries(METRIC_FIELDS.map(f=>[f,0]));}
export function settingFields(kind:SettingKind){return kind==='recommender-settings'?Object.keys(DEFAULT_WEIGHTS):kind==='reasoning-settings'?Object.keys(MODEL_REASONING):kind==='prompt'?['prompt','modelTier','contextFlags']:kind==='theme'||kind==='plan-model'?['value']:[];}
export function knownSetting(kind:SettingKind,id:string){return kind==='prompt'?DEFAULT_PROMPTS.some(p=>p.id===id):id===SETTINGS_KEYS[kind];}
