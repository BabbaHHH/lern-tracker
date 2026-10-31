import type { OnboardingData, AgEntry, LerngruppeEntry, RepEntry, SonstigesEntry } from '../store';
import { isDateOnly } from '../dates';
import { studyPhaseErrors } from '../study-phases';
import { TOPICS } from '../topics';

export type ManualRep = Omit<RepEntry, 'schedule' | 'scheduleDocIndex'>;
export interface ManualProfileFields {
  completed: boolean; maxDailyHours: number; freeDayPerWeek: string; vacationDates: string[];
  ags: AgEntry[]; lerngruppen: LerngruppeEntry[]; reps: ManualRep[]; sonstiges: SonstigesEntry[];
  kaiserSeminare: OnboardingData['kaiserSeminare']; probeexamen1Start: string; probeexamen2Start: string;
  selfAssessment: Record<string, number>; notes: string;
}
export const PROFILE_FIELDS = ['bundesland','examDate','lernstart','refStartDate','studyPlanningMode','studyPhasesEnabled','studyPhases',
  'completed','maxDailyHours','freeDayPerWeek','vacationDates','ags','lerngruppen','reps','sonstiges','kaiserSeminare','probeexamen1Start','probeexamen2Start','selfAssessment','notes'] as const;
export const PROFILE_BUDGET_FIELDS = ['maxDailyHours','freeDayPerWeek','vacationDates','ags','lerngruppen','reps','sonstiges','kaiserSeminare','probeexamen1Start','probeexamen2Start'] as const;
export type ProfileBudget = Partial<Pick<ManualProfileFields, typeof PROFILE_BUDGET_FIELDS[number]>>;
export const PROFILE_WEEKDAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'] as const;
const frequencies = ['wöchentlich','2x/Woche','14-tägig','alle 2 Wochen','zweiwöchentlich','monatlich','unregelmäßig','selten'];
const recurringFields = {
  ags: ['id','label','day','frequency','topic','durationHours','prepHours','postHours','startDate','endDate'],
  lerngruppen: ['id','label','day','frequency','durationHours','prepHours','postHours','startDate','endDate'],
  reps: ['id','label','day','durationHours','prepHours','postHours','startDate','endDate'],
  sonstiges: ['id','label','day','frequency','durationHours','startDate','endDate'],
};
const phaseFields = ['id','label','start','end','focus','perspective','sourceDocument'];
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number, nonempty = false): v is string => typeof v === 'string' && v.length <= max && (!nonempty || !!v.trim());
const id = (v: unknown) => text(v,100,true) && /^[a-zA-Z0-9_-]+$/.test(v);
const date = (v: unknown) => typeof v === 'string' && (v === '' || isDateOnly(v));
const hours = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && Number.isInteger(v * 60);
const keys = (v: Record<string,unknown>, allowed: readonly string[]) => Object.keys(v).every(k => allowed.includes(k));
const topicIds = new Set<string>();
const visit = (items: typeof TOPICS) => { for (const item of items) { topicIds.add(item.id); if (item.children) visit(item.children); } };
visit(TOPICS);

/** Only submitted fields are validated: a small patch never rewrites historical extras. */
export function profilePatchError(p: unknown): string | null {
  if (!object(p) || !Object.keys(p).length || !keys(p, PROFILE_FIELDS)) return 'Bitte zulässige Profilfelder angeben.';
  for (const [key, v] of Object.entries(p)) {
    if (['examDate','lernstart','refStartDate','probeexamen1Start','probeexamen2Start'].includes(key) && !date(v)) return 'Bitte ein gültiges Datum eintragen.';
    if (key === 'bundesland' && !text(v,100)) return 'Ungültiges Bundesland.';
    if (key === 'notes' && !text(v,10000)) return 'Die Notizen dürfen höchstens 10000 Zeichen enthalten.';
    if (['completed','studyPhasesEnabled'].includes(key) && typeof v !== 'boolean') return 'Ungültiger Profilstatus.';
    if (key === 'studyPlanningMode' && (typeof v !== 'string' || !['station','custom'].includes(v))) return 'Ungültige Planungsart.';
    if (key === 'maxDailyHours' && !hours(v,1,10)) return 'Die tägliche Lernzeit muss zwischen 1 und 10 Stunden liegen (ganze Minuten).';
    if (key === 'freeDayPerWeek' && !PROFILE_WEEKDAYS.includes(v as typeof PROFILE_WEEKDAYS[number])) return 'Bitte einen gültigen freien Wochentag wählen.';
    if (key === 'vacationDates' && (!Array.isArray(v) || v.length > 730 || v.some(d => typeof d !== 'string' || !isDateOnly(d)) || new Set(v).size !== v.length)) return 'Bitte höchstens 730 eindeutige gültige Urlaubstage angeben.';
    if (key === 'studyPhases') {
      const errors = studyPhaseErrors(v); if (errors.length) return errors[0];
      for (const phase of v as Record<string,unknown>[]) if (!keys(phase,phaseFields) || !id(phase.id) || !text(phase.label,120,true) || (phase.sourceDocument !== undefined && !text(phase.sourceDocument,500))) return 'Ungültiger Stationsabschnitt.';
    }
    if (Object.hasOwn(recurringFields,key)) {
      if (!Array.isArray(v) || v.length > 100) return 'Bitte höchstens 100 Termine pro Terminart angeben.';
      const allowed = recurringFields[key as keyof typeof recurringFields], seen = new Set<unknown>();
      for (const entry of v) {
        if (!object(entry) || !keys(entry,allowed) || !allowed.every(k => Object.hasOwn(entry,k)) || !id(entry.id) || seen.has(entry.id)
          || !text(entry.label,200,true) || !PROFILE_WEEKDAYS.includes(entry.day as typeof PROFILE_WEEKDAYS[number])
          || !hours(entry.durationHours,1/60,key === 'sonstiges' ? 24 : 12)
          || !date(entry.startDate) || !date(entry.endDate) || (entry.startDate && entry.endDate && String(entry.startDate) > String(entry.endDate))
          || (allowed.includes('frequency') && !(key === 'sonstiges' && entry.frequency === 'täglich') && (typeof entry.frequency !== 'string' || !frequencies.includes(entry.frequency)))
          || (allowed.includes('topic') && !text(entry.topic,500))
          || (allowed.includes('prepHours') && (!hours(entry.prepHours,0,12) || !hours(entry.postHours,0,12)))) return 'Bitte gültige Termine mit eindeutiger Kennung, Wochentag, Zeitraum und Dauer eintragen.';
        seen.add(entry.id);
      }
    }
    if (key === 'kaiserSeminare') {
      if (!Array.isArray(v) || v.length > 100) return 'Bitte höchstens 100 Kaiserseminare angeben.';
      const seen = new Set<string>();
      for (const entry of v) {
        if (!object(entry) || !keys(entry,['date','topic','durationDays']) || typeof entry.date !== 'string' || !isDateOnly(entry.date) || !text(entry.topic,200,true) || !Number.isInteger(entry.durationDays) || Number(entry.durationDays) < 1 || Number(entry.durationDays) > 30 || seen.has(`${entry.date}|${entry.topic}`)) return 'Bitte gültige Kaiserseminare mit 1 bis 30 Tagen angeben.';
        seen.add(`${entry.date}|${entry.topic}`);
      }
    }
    if (key === 'selfAssessment' && (!object(v) || Object.keys(v).length > topicIds.size || Object.entries(v).some(([k,n]) => !topicIds.has(k) || typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 100))) return 'Bitte bekannte Themen und Selbsteinschätzungen von 0 bis 100 angeben.';
  }
  return null;
}

const pick = (p: Record<string,unknown>, allowed: readonly string[]) => Object.fromEntries(Object.entries(p).filter(([k]) => allowed.includes(k)));
/** No parser text or source identity is exposed as editable recurring input. No generated IDs/defaults. */
export function projectProfile(p: Record<string,unknown>): Record<string,unknown> {
  const result = pick(p, PROFILE_FIELDS);
  for (const [key, allowed] of Object.entries({...recurringFields, studyPhases:phaseFields})) {
    if (Array.isArray(result[key])) result[key] = result[key].filter(object).map(entry => pick(entry, allowed));
  }
  if (Array.isArray(result.kaiserSeminare)) result.kaiserSeminare = result.kaiserSeminare.filter(object).map(entry => pick(entry,['date','topic','durationDays']));
  return result;
}
export function profileBudgetProjection(p: Record<string,unknown>, preserveProvenance = false): ProfileBudget {
  // Server calculations retain already stored parser metadata; editable views strip it.
  return pick(preserveProvenance ? p : projectProfile(p),PROFILE_BUDGET_FIELDS);
}

/** Replace explicit lists; merge same-ID entries to retain private historical provenance. */
export function mergeProfilePatch(old: Record<string,unknown>, patch: Record<string,unknown>): Record<string,unknown> {
  const result = {...old,...patch};
  for (const key of [...Object.keys(recurringFields),'studyPhases']) {
    if (!Array.isArray(patch[key])) continue;
    const previous = Array.isArray(old[key]) ? old[key].filter(object) : [];
    result[key] = (patch[key] as Record<string,unknown>[]).map(entry => {
      const prior = previous.find(p => p.id === entry.id);
      return {...prior,...entry};
    });
  }
  if (Array.isArray(patch.kaiserSeminare)) {
    const previous = Array.isArray(old.kaiserSeminare) ? old.kaiserSeminare.filter(object) : [];
    result.kaiserSeminare = (patch.kaiserSeminare as Record<string,unknown>[]).map(entry => ({...previous.find(p => p.date === entry.date && p.topic === entry.topic),...entry}));
  }
  return result;
}
