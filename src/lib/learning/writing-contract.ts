import type {Area,KlausurType} from '../types';
import type {LearningAccount} from './progress-contract';
export const NOTEPAD_ID='lerntracker-freitext';
export const WRITING_BODY_LIMIT=1_600_000;
export const WRITING_TYPES:Record<Area,KlausurType[]>={zr:['Urteil','Beschluss','Anwaltsklausur','Kautelarklausur'],oeffr:['Urteil','Beschluss','Anwaltsklausur','Behördenklausur','Aktenvortrag'],sr:['Anklageklausur','Revisionsklausur','Plädoyer','Haftklausur','Einspruch Strafbefehl','Abschlussverfügung']};
export type WritingKind='draft'|'notepad';
export interface WritingSelection {kind:WritingKind;id:string}
export interface DraftFields {title:string;area?:Area;type?:KlausurType;klausurId?:string;sachverhalt?:string;contentHtml:string;contentText:string}
export interface NotepadFields {html:string;text:string}
export type WritingFields=DraftFields|NotepadFields;
export type WritingPatch=Partial<Omit<DraftFields,'area'|'type'|'klausurId'>>&{area?:Area|null;type?:KlausurType|null;klausurId?:string|null}|NotepadFields;
export interface WritingDocument extends WritingSelection {revision:number;deleted:boolean;fields:WritingFields;createdAt?:string;updatedAt:string;feedback:{feedbackText:string;createdAt?:string}[]}
export interface WritingSummary {id:string;revision:number;title:string;area?:Area;type?:KlausurType;klausurId?:string;updatedAt:string;words:number;feedbackCount:number}
export interface WritingReceipt extends WritingSelection {requestId:string;operation:'save'|'delete';revision:number;createdAt:string}
export interface WritingView {contractVersion:1;account:LearningAccount;drafts:WritingSummary[];truncated:boolean;document:WritingDocument|null;recent:WritingReceipt[]}
export interface WritingCommand extends WritingSelection {contractVersion:1;action:'writing';requestId:string;expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string;expectedRevision:number|null;operation:'save'|'delete';fields?:WritingPatch}
export interface WritingResult {contractVersion:1;account:LearningAccount;requestId:string;action:'writing';operation:'save'|'delete';document:WritingDocument;replay:boolean;createdAt:string}
export const writingKey=(v:WritingSelection)=>`${v.kind}:${v.id}`;
export const writingPageAllowed=(path:string)=>path==='/schreiben'||path==='/schreiben/notizblock'||/^\/schreiben\/[a-zA-Z0-9_-]{1,100}$/.test(path);
