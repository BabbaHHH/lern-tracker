import type {LearningAccount} from './progress-contract';
import type {PlanChange} from './plan-contract';
import type {DailyTask} from '../store';

export interface PreparationBacklog {task:DailyTask;reason:string}
export interface PreparationView {
 contractVersion:1;account:LearningAccount;snapshot:string;today:string;end:string;backlog:PreparationBacklog[];
}
export interface PreparationPreview {
 contractVersion:1;account:LearningAccount;snapshot:string;dates:string[];end:string;
 changes:PlanChange[];backlog:PreparationBacklog[];warnings:string[];created:number;moved:number;deferred:number;
}
export interface PreparationInput {
 contractVersion:1;expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string;
 dates:string[];snapshot:string;
}
export interface PreparationCommand extends PreparationInput {action:'preparation';requestId:string}
export interface PreparationResult {
 contractVersion:1;action:'preparation';requestId:string;account:LearningAccount;input:PreparationCommand;
 changes:{kind:string;id:string;revision:number}[];replay:boolean;view:PreparationView;
}
