import type {AccountScheduleData} from './account-schedule';
import type {ScheduleView} from '@/lib/learning/schedule-contract';
export interface AccountCalendarAdapter extends AccountScheduleData {
 openDay:(date:string)=>void;
 saveExamDate:(date:string,rendered:ScheduleView)=>Promise<void>;
}
