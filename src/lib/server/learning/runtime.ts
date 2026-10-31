import { accountRuntime } from "../auth/runtime";
import { AccountError } from "../auth/security";
import { ProgressService } from "./progress-service";
export async function progressRuntime():Promise<ProgressService> {
  if (process.env.STEX_LEARNING_MODE !== "account") throw new AccountError("unavailable","Die Kontolernansicht ist noch nicht eingerichtet.",503);
  return new ProgressService(await accountRuntime());
}

export async function personalRuntime():Promise<import('./personal-service').PersonalService> {
  if(process.env.STEX_LEARNING_MODE!=='account')throw new AccountError('unavailable','Die Kontolernansicht ist noch nicht eingerichtet.',503);
  const {PersonalService}=await import('./personal-service');
  return new PersonalService(await accountRuntime());
}

export async function scheduleRuntime():Promise<import('./schedule-service').ScheduleService>{
 if(process.env.STEX_LEARNING_MODE!=='account')throw new AccountError('unavailable','Die Kontolernansicht ist noch nicht eingerichtet.',503);
 const {ScheduleService}=await import('./schedule-service');return new ScheduleService(await accountRuntime());
}

export async function planRuntime():Promise<import('./plan-service').PlanService>{
 if(process.env.STEX_LEARNING_MODE!=='account')throw new AccountError('unavailable','Die Kontolernansicht ist noch nicht eingerichtet.',503);
 const {PlanService}=await import('./plan-service');return new PlanService(await accountRuntime());
}

export async function preparationRuntime():Promise<import('./preparation-service').PreparationService>{
 if(process.env.STEX_LEARNING_MODE!=='account')throw new AccountError('unavailable','Die Kontolernansicht ist noch nicht eingerichtet.',503);
 const {PreparationService}=await import('./preparation-service');return new PreparationService(await accountRuntime());
}

export async function checkinRuntime():Promise<import('./checkin-service').CheckinService>{
 if(process.env.STEX_LEARNING_MODE!=='account')throw new AccountError('unavailable','Die Kontolernansicht ist noch nicht eingerichtet.',503);
 const [{CheckinService},{aiCredentialRuntime}]=await Promise.all([import('./checkin-service'),import('../ai-credentials/runtime')]);
 const credentials=await aiCredentialRuntime();return new CheckinService(credentials.auth,credentials);
}

export async function writingRuntime():Promise<import('./writing-service').WritingService>{
 if(process.env.STEX_LEARNING_MODE!=='account')throw new AccountError('unavailable','Die Kontolernansicht ist noch nicht eingerichtet.',503);
 const {WritingService}=await import('./writing-service');return new WritingService(await accountRuntime());
}

export async function correctionRuntime():Promise<import('./correction-service').CorrectionService>{
 if(process.env.STEX_LEARNING_MODE!=='account')throw new AccountError('unavailable','Die Kontolernansicht ist noch nicht eingerichtet.',503);
 const [{CorrectionService},{aiCredentialRuntime}]=await Promise.all([import('./correction-service'),import('../ai-credentials/runtime')]);const credentials=await aiCredentialRuntime();return new CorrectionService(credentials.auth,credentials);
}

export async function documentsRuntime():Promise<import('./documents-service').DocumentsService>{
 if(process.env.STEX_LEARNING_MODE!=='account')throw new AccountError('unavailable','Die Kontodokumente sind noch nicht eingerichtet.',503);
 const {DocumentsService}=await import('./documents-service');return new DocumentsService(await accountRuntime());
}

export async function settingsRuntime():Promise<import('./settings-service').SettingsService>{
 if(process.env.STEX_LEARNING_MODE!=='account')throw new AccountError('unavailable','Kontoeinstellungen sind nicht eingerichtet.',503);
 const {SettingsService}=await import('./settings-service');return new SettingsService(await accountRuntime());
}
