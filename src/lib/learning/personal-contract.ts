import type { LearningAccount } from './progress-contract';
import type { LearningEntry } from '../types';
import type { StudyPhase } from '../study-phases';
import type { ManualProfileFields } from './profile-fields';
import { projectProfile } from './profile-fields';
export interface ProfileFields extends Partial<ManualProfileFields> {
  bundesland:string; examDate:string; lernstart:string; refStartDate:string;
  studyPlanningMode:'station'|'custom'; studyPhasesEnabled:boolean; studyPhases:StudyPhase[];
}
export type ProfilePatch = Partial<ProfileFields>;
export interface PersonalRecord<T> {id:string;revision:number;value:T}
export interface ProfileRevisions {profile:number|null;examDate:number|null;lernstart:number|null}
export interface PersonalView {contractVersion:1;account:LearningAccount;profile:PersonalRecord<Partial<ProfileFields>>|null;examDate:PersonalRecord<string>|null;lernstart:PersonalRecord<string>|null;notes:PersonalRecord<LearningEntry>[]}
interface Base {contractVersion:1;requestId:string;expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string}
export interface ProfileCommand<Fields extends ProfilePatch=ProfileFields> extends Base {action:'profile';fields:Fields;expectedRevisions:ProfileRevisions}
export interface NoteCommand extends Base {action:'note';id:string;topicId:string;note:string;expectedRevision:number|null}
export type PersonalCommand<Fields extends ProfilePatch=ProfileFields>=ProfileCommand<Fields>|NoteCommand;
export type PersonalPatchCommand=PersonalCommand<ProfilePatch>;
export interface PersonalResult extends PersonalView {requestId:string;action:'profile'|'note';replay:boolean}
// Editing defaults are view-only; reading never persists them or generates nested IDs.
export function profileDraft(view:PersonalView):ProfileFields {
  const p=view.profile?.value;
  return {...projectProfile(p??{}),bundesland:p?.bundesland??'',examDate:view.examDate?.value??p?.examDate??'',lernstart:view.lernstart?.value??p?.lernstart??'',refStartDate:p?.refStartDate??'',studyPlanningMode:p?.studyPlanningMode??'station',studyPhasesEnabled:p?.studyPhasesEnabled??true,studyPhases:p?.studyPhases??[]};
}
/** Full manual form defaults are display-only; send only the fields consciously edited. */
export function manualProfileDraft(view:PersonalView):ProfileFields & ManualProfileFields {
  return {completed:false,maxDailyHours:7,freeDayPerWeek:'Sonntag',vacationDates:[],ags:[],reps:[],lerngruppen:[],sonstiges:[],kaiserSeminare:[],probeexamen1Start:'',probeexamen2Start:'',selfAssessment:{},notes:'',...profileDraft(view)};
}
export function profileRevisions(view:PersonalView):ProfileRevisions {return {profile:view.profile?.revision??null,examDate:view.examDate?.revision??null,lernstart:view.lernstart?.revision??null};}
export const sameLearningAccount=(a:LearningAccount|null,b:LearningAccount|null)=>!!a&&!!b&&a.userId===b.userId&&a.accessGeneration===b.accessGeneration&&a.sessionContext===b.sessionContext;

export const personalPageAllowed=(path:string)=>path==='/'||path==='/onboarding'||path==='/themen'||path==='/klausuren'||path==='/konto'||path.startsWith('/konto/');
