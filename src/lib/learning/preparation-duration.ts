import type {DailyTask} from '../store';
import {taskMinutes} from '../day-budget';
/** Recognize the existing explicit duration rule without guessing a missing effort. */
export function preparationKnownMinutes(task:DailyTask):number|null {
 if(Number.isFinite(task.durationMinutes)&&Number(task.durationMinutes)>0)return taskMinutes(task);
 const hours=task.title.match(/\((\d+(?:[.,]\d+)?)\s*h\)/i)?.[1];
 return hours&&Number(hours.replace(',','.'))>0?taskMinutes(task):null;
}
