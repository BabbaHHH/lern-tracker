import type { Progress } from "../types";

export interface LearningAccount { userId: string; accessGeneration: number; sessionContext: string }
export interface ProgressRecord { id: string; value: Progress; revision: number }
export interface ProgressView { contractVersion: 1; account: LearningAccount; topicsVersion: string; progress: ProgressRecord[] }
interface CommandBase { contractVersion: 1; requestId: string; expectedAccountId: string; expectedAccessGeneration: number; expectedSessionContext: string }
export interface SetProgress extends CommandBase { action: "set"; changes: {topicId: string;percent: number;expectedRevision: number | null}[] }
export interface UndoProgress extends CommandBase { action: "undo"; undoOfRequestId: string }
export type ProgressCommand = SetProgress | UndoProgress;
export interface ProgressResult { contractVersion: 1; account: LearningAccount; requestId: string; action: "set"|"undo"; progress: ProgressRecord[]; replay: boolean }
export const LEARNING_BODY_LIMIT = 256 * 1024;
export const learningPageAllowed = (path: string) => path === "/themen" || path === "/konto" || path.startsWith("/konto/");
