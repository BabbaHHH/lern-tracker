import type {LearningAccount} from './progress-contract';
import type {StructuredPlan} from '../plan-core';
import type {DailyTask} from '../store';
import type {CalendarEvent} from '../types';
import {schedulePageAllowed} from './schedule-contract';
export const planPageAllowed=(path:string)=>path==='/plan'||schedulePageAllowed(path);
export interface SavedPlan {id:string;revision:number;reply:string;structured:StructuredPlan|null;createdAt:string;operation:'draft'|'apply'|'undo'|'historical';requestId?:string;undoOf?:string;range?:{start:string;end:string};warnings?:string[]}
export interface PlanView {contractVersion:1;account:LearningAccount;resultRevision:number|null;currentDraftId:string|null;history:SavedPlan[];historyTruncated:boolean;snapshot:string}
export interface PlanChange {kind:'task'|'calendar-event';id:string;before:DailyTask|CalendarEvent|null;after:DailyTask|CalendarEvent|null}
export interface PlanPreview {contractVersion:1;account:LearningAccount;planId:string;planRevision:number;snapshot:string;range:{start:string;end:string};changes:PlanChange[];warnings:string[];moved:number;deferred:number;klausurenSkipped:number}
export type PlanOperation={type:'save';reply:string;expectedResultRevision:number|null}|{type:'apply';planId:string;planRevision:number;snapshot:string}|{type:'undo';applyRequestId:string;snapshot:string};
export interface PlanCommand {contractVersion:1;action:'plan';requestId:string;expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string;operation:PlanOperation}
export interface PreviewCommand {contractVersion:1;expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string;planId:string;planRevision:number;snapshot:string}
export interface PlanResult {contractVersion:1;action:'plan';requestId:string;account:LearningAccount;input:PlanCommand;view:PlanView;replay:boolean;changes:{kind:string;id:string;revision:number}[]}
