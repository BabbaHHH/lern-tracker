import type {LearningAccount} from './progress-contract';
export const DOCUMENT_LIMIT = 4 * 1024 * 1024;
export const DOCUMENT_META_LIMIT = 16 * 1024;
export interface DocumentFields {name:string;tags:string[];includeInNextPlan:boolean}
export interface DocumentVersion {id:string;sha256:string;size:number;type:string;name:string;current:boolean}
export interface PersonalDocument extends DocumentFields {id:string;revision:number;deleted:boolean;currentVersionId:string|null;sourceVersionId:string|null;hasLegacyText:boolean;versions:DocumentVersion[];updatedAt:string}
export interface DocumentsView {contractVersion:1;account:LearningAccount;documents:PersonalDocument[];truncated:boolean;recent:{requestId:string;status:DocumentsResult['status'];createdAt:string}[]}
export interface DocumentsCommand {contractVersion:1;action:'documents';requestId:string;expectedAccountId:string;expectedAccessGeneration:number;expectedSessionContext:string;id:string;expectedRevision:number|null;operation:'upload'|'metadata'|'remove';fields?:DocumentFields;file?:{name:string;size:number;type:string;sha256:string}}
export interface DocumentsResult {contractVersion:1;account:LearningAccount;requestId:string;status:'pending'|'committed';document:PersonalDocument|null;createdAt:string;replay:boolean}
export const documentsAccountKey=(a:LearningAccount)=>JSON.stringify([a.userId,a.accessGeneration,a.sessionContext]);
export const documentFileURL=(d:PersonalDocument,v:DocumentVersion)=>`/api/learning/documents/${encodeURIComponent(d.id)}/versions/${encodeURIComponent(v.id)}?revision=${d.revision}`;
