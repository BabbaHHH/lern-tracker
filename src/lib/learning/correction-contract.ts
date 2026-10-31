import type {KorrekturSettings,FehlerProfil,KlausurFeedback} from '../types';
import type {LearningAccount} from './progress-contract';
export const CORRECTION_SETTINGS_ID='lerntracker-korrektur-settings';
export const ERROR_PROFILE_ID='lerntracker-fehlerprofil';
export const CORRECTION_BODY_LIMIT=16000;
export type CorrectionFocus={mode:'gesamt'}|{mode:'manuell';start:number;end:number}|{mode:'wort'|'satz'|'absatz';caret:number};
interface Base {contractVersion:1;action:'correction';requestId:string;expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string}
export type CorrectionCommand=Base&({operation:'settings';expectedRevision:number|null;fields:KorrekturSettings}|{operation:'reset';expectedRevision:number|null}|{operation:'run';draftId:string;expectedDraftRevision:number;snapshot:string;focus:CorrectionFocus}|{operation:'abandon';targetRequestId:string});
export interface CorrectionResult {contractVersion:1;action:'correction';account:LearningAccount;requestId:string;operation:CorrectionCommand['operation'];state:'pending'|'applied'|'failed';createdAt:string;message:string;draftId?:string;draftRevision?:number;sourceDraftRevision?:number;settingsRevision?:number;profileRevision?:number;feedback?:KlausurFeedback;errorCode?:string;targetRequestId?:string;sessionCurrent?:boolean;replay:boolean}
export interface CorrectionView {contractVersion:1;account:LearningAccount;settings:KorrekturSettings;settingsRevision:number|null;settingsDefault:boolean;legacyModelUpgraded:boolean;profile:FehlerProfil|null;profileRevision:number|null;promptDefaults:boolean;reasoningDefault:boolean;issues:string[];snapshot:string|null;draftId:string|null;draftRevision:number|null;deleted:boolean;recent:CorrectionResult[]}
