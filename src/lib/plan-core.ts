/** Existing plan parser/placement, extracted behind explicit data adapters. No browser store import. */
import {isDateOnly,localDate} from './dates';
import {addDays,differenceInCalendarDays,parseISO} from 'date-fns';
import {computeDayBudget,dailyHours,eventsOnDate,isFixedTask,isStudyFreeDay,isTerminTitle,planningEvents} from './day-budget';
import {planningEnd,rebalanceTasks} from './learning-planner';
import {studyPhaseErrors,type StudyPhase} from './study-phases';
import {frequencyMatches} from './recurrence';
import {TOPICS,getLeafTopics} from './topics';
import type {DailyTask,PlanAppliedRange,OnboardingData,RepScheduleEntry,AgWeekOverride} from './store';
import type {Area,CalendarEvent,Klausur} from './types';
export interface PlanningSnapshot {tasks:DailyTask[];events:CalendarEvent[];range:PlanAppliedRange|null;onboarding:OnboardingData}
export interface PlanDataAdapter {
 mode:'browser'|'account';getTasks:()=>DailyTask[];getCalendarEvents:()=>CalendarEvent[];
 getOnboarding:()=>OnboardingData;getKlausuren:()=>Klausur[];getAgWeekOverrides:()=>Record<string,AgWeekOverride>;
 addTask:(task:Omit<DailyTask,'id'|'done'|'createdAt'>)=>unknown;updateTask:(id:string,fields:Partial<DailyTask>)=>unknown;removeTask:(id:string)=>unknown;
 setOnboarding:(value:OnboardingData)=>void;snapshot:()=>PlanningSnapshot;writeSnapshot:(value:PlanningSnapshot)=>void;
 newId:()=>string;now:()=>string;
 protectedTaskIds?:ReadonlySet<string>;
}
const WEEKDAY_TO_INDEX:Record<string,number>={Montag:0,Dienstag:1,Mittwoch:2,Donnerstag:3,Freitag:4,Samstag:5,Sonntag:6};
function getWeekKey(date:Date):string {const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));const week=Math.ceil((((d.getTime()-yearStart.getTime())/86400000)+1)/7);return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;}
export interface PlanTask {
  date: string;
  title: string;
  topicId?: string;
  minutes?: number;
  isReview?: boolean;
}

export interface PlanKlausur {
  date: string;
  label: string;
  area: Area;
  klausurId?: string;
}

export interface PlanAppointment {
  date: string;
  label: string;
  eventType: CalendarEvent["eventType"];
  durationMinutes?: number;
  sourceDocument: string;
}

export interface StructuredPlan {
  tasks: PlanTask[];
  klausuren: PlanKlausur[];
  studyPhases?: StudyPhase[];
  appointments?: PlanAppointment[];
}

/** Extrahiert den letzten ```json … ``` Block aus dem Markdown-Output. */
export function parseStructuredPlan(reply: string): StructuredPlan | null {
  if (!reply) return null;
  // Letzter ```json ... ``` Block (bevorzugt explizit markiert)
  const jsonBlocks = [...reply.matchAll(/```json\s*([\s\S]*?)```/gi)];
  let raw: string | null = null;
  if (jsonBlocks.length > 0) {
    raw = jsonBlocks[jsonBlocks.length - 1][1].trim();
  } else {
    // Fallback: irgendein ``` block
    const anyBlocks = [...reply.matchAll(/```\s*([\s\S]*?)```/g)];
    if (anyBlocks.length > 0) raw = anyBlocks[anyBlocks.length - 1][1].trim();
  }
  if (!raw) return null;
  try {
    return validateStructuredPlan(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Reject malformed model output before it can mutate existing plans. */
export function validateStructuredPlan(value: unknown): StructuredPlan | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Partial<StructuredPlan>;
  if (!Array.isArray(plan.tasks) || !Array.isArray(plan.klausuren) || plan.tasks.length + plan.klausuren.length > 1000) return null;
  for (const task of plan.tasks) {
    if (!task || typeof task.date !== "string" || !isDateOnly(task.date) || typeof task.title !== "string" || !task.title.trim() || task.title.length > 500) return null;
    if (task.minutes !== undefined && (typeof task.minutes !== "number" || !Number.isFinite(task.minutes) || task.minutes < 15 || task.minutes > 600)) return null;
    if (task.topicId !== undefined && typeof task.topicId !== "string") return null;
    if (task.isReview !== undefined && typeof task.isReview !== "boolean") return null;
  }
  for (const exam of plan.klausuren) {
    if (!exam || typeof exam.date !== "string" || !isDateOnly(exam.date) || typeof exam.label !== "string" || !exam.label.trim() || exam.label.length > 500 || !["zr", "sr", "oeffr"].includes(exam.area)) return null;
    if (exam.klausurId !== undefined && (typeof exam.klausurId !== "string" || exam.klausurId.length > 150)) return null;
  }
  if (plan.studyPhases !== undefined && (studyPhaseErrors(plan.studyPhases).length || plan.studyPhases.some(phase => typeof phase.sourceDocument !== "string" || !phase.sourceDocument.trim() || phase.sourceDocument.length > 300))) return null;
  if (plan.appointments !== undefined) {
    if (!Array.isArray(plan.appointments) || plan.appointments.length > 1000) return null;
    for (const appointment of plan.appointments) {
      if (!appointment || !isDateOnly(appointment.date) || typeof appointment.label !== "string" || !appointment.label.trim() || appointment.label.length > 500 || !["ag", "rep", "kaiser", "probeexamen", "urlaub", "frei", "sport", "klausur"].includes(appointment.eventType) || typeof appointment.sourceDocument !== "string" || !appointment.sourceDocument.trim() || appointment.sourceDocument.length > 300) return null;
      if (appointment.durationMinutes !== undefined && (!Number.isFinite(appointment.durationMinutes) || appointment.durationMinutes <= 0 || appointment.durationMinutes > 1440)) return null;
    }
  }
  return { tasks: plan.tasks.map(task => ({ ...task, title: task.title.trim() })), klausuren: plan.klausuren.map(exam => ({ ...exam, label: exam.label.trim() })), studyPhases: plan.studyPhases, appointments: plan.appointments };
}

/** Entfernt den JSON-Block aus dem Markdown — für die UI-Anzeige. */
export function stripJsonBlock(reply: string): string {
  return reply.replace(/```json\s*[\s\S]*?```/gi, "").trim();
}

export function materializeRecurringWithAdapter(adapter:PlanDataAdapter,start:string,end:string):{created:number}{
 const {getTasks,getOnboarding,getAgWeekOverrides,addTask,updateTask,removeTask}=adapter;
interface RecurringTermin {
  id: string;
  label: string;
  day: string; // "Montag"|"Dienstag"|...
  frequency?: string; // "wöchentlich"|"alle 2 Wochen"|...
  durationHours: number;
  prepHours: number;
  postHours: number;
  startDate?: string;
  endDate?: string;
  kind: "ag" | "rep" | "lerngruppe" | "sonstiges";
  /** Nur bei kind=rep: optional, Datum→Inhalt-Mapping aus dem Rep-Plan. */
  schedule?: RepScheduleEntry[];
}

function* eachDateInRange(start: string, end: string): Generator<Date> {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const cur = new Date(s);
  while (cur <= e) {
    yield new Date(cur);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Datum für Vorbereitungs-Tasks: Lerngruppe wird AM Termintag vorbereitet
 * (User-Wunsch — der Vortag ist durch Rep + AG-Vorbereitung schon voll),
 * AG/Rep/Sonstiges am Vortag.
 */
function prepDateFor(kind: RecurringTermin["kind"], terminDate: Date): string {
  if (kind === "lerngruppe") return isoDate(terminDate);
  const prev = new Date(terminDate);
  prev.setUTCDate(prev.getUTCDate() - 1);
  return isoDate(prev);
}

function recurringId(termin: RecurringTermin): string { return termin.id ? `id:${termin.id}` : termin.label; }

function matchesTermin(termin: RecurringTermin, date: Date, termine: RecurringTermin[]): boolean {
  const dateStr = isoDate(date);
  if (termin.startDate && dateStr < termin.startDate || termin.endDate && dateStr > termin.endDate) return false;
  const dayIndex = (date.getUTCDay() + 6) % 7;
  if (termin.kind === "ag") {
    const override = getAgWeekOverrides()[getWeekKey(new Date(dateStr + "T12:00:00"))];
    if (override) {
      const active = termine.filter(item => item.kind === "ag" && (!item.startDate || item.startDate <= dateStr) && (!item.endDate || item.endDate >= dateStr));
      // One AG: the week editor can move/add its days. With overlapping AGs,
      // retain the assignment from the profile instead of duplicating every AG.
      return override.agDays.includes(dayIndex) && (active.length === 1 || WEEKDAY_TO_INDEX[termin.day] === dayIndex);
    }
  }
  return (isDailyFreq(termin.frequency) || WEEKDAY_TO_INDEX[termin.day] === dayIndex)
    && frequencyMatches(termin.frequency, date, termin.startDate);
}

function isDailyFreq(frequency: string | undefined): boolean {
  return frequency === "täglich" || frequency === "daily" || frequency === "jeden Tag";
}

/**
 * Erzeugt Tasks für wiederkehrende Termine (AG, Rep, Lerngruppe, Sonstiges) im Bereich [start, end].
 * Pro Termin: 1 Task am Termintag (Inhalt + Dauer) + optional Vorb./Nachb. Tasks.
 * Idempotent: prüft auf Duplikate via (date, title).
 */
function materializeRecurringTermine(start: string, end: string): { created: number } {
  if (!isDateOnly(start) || !isDateOnly(end) || end < start || differenceInCalendarDays(parseISO(end), parseISO(start)) > 400) throw new Error("Ungültiger Planungszeitraum (maximal 400 Tage).");
  const o = getOnboarding();
  const termine: RecurringTermin[] = [
    ...(o.ags || []).map(a => ({ id: a.id, label: a.label, day: a.day, frequency: a.frequency, durationHours: a.durationHours, prepHours: a.prepHours, postHours: a.postHours, startDate: a.startDate, endDate: a.endDate, kind: "ag" as const })),
    ...(o.reps || []).map(r => ({ id: r.id, label: r.label, day: r.day, durationHours: r.durationHours, prepHours: r.prepHours, postHours: r.postHours, startDate: r.startDate, endDate: r.endDate, kind: "rep" as const, schedule: r.schedule })),
    ...(o.lerngruppen || []).map(l => ({ id: l.id, label: l.label, day: l.day, frequency: l.frequency, durationHours: l.durationHours, prepHours: l.prepHours, postHours: l.postHours, startDate: l.startDate, endDate: l.endDate, kind: "lerngruppe" as const })),
    ...(o.sonstiges || []).map(s => ({ id: s.id, label: s.label || "Sonstiger Termin", day: s.day, frequency: s.frequency, durationHours: s.durationHours, prepHours: 0, postHours: 0, startDate: s.startDate, endDate: s.endDate, kind: "sonstiges" as const })),
  ];

  for (const termin of termine) {
    for (const key of ["durationHours", "prepHours", "postHours"] as const) {
      termin[key] = Number.isFinite(termin[key]) ? Math.max(0, Math.min(24, termin[key])) : 0;
    }
  }

  // Erst: Migration & Dedup. Alte Tasks ohne recurringKey, die wie Termine
  // aussehen (label-Pattern matcht), bekommen einen recurringKey rückwirkend
  // zugewiesen. Bei Duplikaten (gleicher recurringKey) wird die Variante mit
  // contentSummary bevorzugt, die andere gelöscht.
  if(adapter.mode==='browser') for (const task of getTasks()) {
    if (!task.recurringKey) continue;
    const [kind, label, date, slot] = task.recurringKey.split("|");
    if (label?.startsWith("id:")) continue;
    const candidates = termine.filter(item => item.kind === kind && item.label === label);
    const matches = candidates.length <= 1 ? candidates : candidates.filter(item => matchesTermin(item, new Date(date + "T00:00:00Z"), termine)).slice(0, 1);
    if (matches.length === 1 && matches[0].id) updateTask(task.id, { recurringKey: `${kind}|${recurringId(matches[0])}|${date}|${slot}` });
  }
  if(adapter.mode==='browser') migrateAndDedupRecurringTasks(termine);

  // Stale Tasks VOR der Erzeugung entfernen — so werden falsch datierte/
  // falsch-wöchige Altlasten im selben Durchlauf am richtigen Datum neu erzeugt.
  if(adapter.mode==='browser') cleanupStaleRecurringTasks(termine, start, end);

  const existing = getTasks();
  // Settings edits must update durations, including removing zero-length prep/post.
  if(adapter.mode==='browser') for (const task of existing) {
    if (task.done || !task.recurringKey || task.date < start || task.date > end) continue;
    const [kind, label, , slot] = task.recurringKey.split("|");
    const termin = termine.find(item => item.kind === kind && (recurringId(item) === label || item.label === label));
    if (!termin) continue;
    const hours = slot === "prep" ? termin.prepHours : slot === "post" ? termin.postHours : termin.durationHours;
    if (!Number.isFinite(hours) || hours <= 0) { removeTask(task.id); continue; }
    const title = task.title.replace(/\(\d+(?:[.,]\d+)?\s*h\)/i, `(${hours}h)`);
    if (task.durationMinutes !== Math.round(hours * 60) || task.title !== title) updateTask(task.id, { durationMinutes: Math.round(hours * 60), title });
  }
  const current = getTasks();
  const existingKeySet = new Set(
    current
      .map(t => t.recurringKey)
      .filter((k): k is string => !!k)
  );
  // Zweiter Duplikat-Schutz über (date, title) — fängt Altlasten ab, deren
  // recurringKey aus einer früheren Version abweicht (z.B. Vorb.-Tasks, deren
  // Key mit dem Vorbereitungs- statt dem Termindatum gebaut wurde).
  const existingDateTitle = new Set(current.filter(task => adapter.mode==='account'||!task.recurringKey).map(t => `${t.date}|${t.title}`));
  const covered=(key:string,termin:RecurringTermin,date:string,slot:string)=>{
    if(existingKeySet.has(key))return true;
    if(adapter.mode!=='account'||!existingKeySet.has(`${termin.kind}|${termin.label}|${date}|${slot}`))return false;
    if(termine.filter(item=>item.kind===termin.kind&&item.label===termin.label&&matchesTermin(item,new Date(date+'T00:00:00Z'),termine)).length>1)throw new Error(`Der vorhandene Wiederholungstermin „${termin.label}“ ist nicht eindeutig zugeordnet. Bitte zuerst die bestehende Zuordnung klären.`);
    // Keep the old row/key and duration. This is duplicate protection, not an ID backfill.
    return true;
  };
  let created = 0;

  for (const d of eachDateInRange(start, localDate(addDays(parseISO(end), 1)))) {
    for (const t of termine) {
      if (!matchesTermin(t, d, termine)) continue;

      const dateStr = isoDate(d);

      // Rep mit Schedule: pro Datum nach passendem Schedule-Eintrag suchen.
      // Wenn gefunden → Titel um Schedule-Titel erweitern, Topics linken,
      //                 Inhalts-Summary speichern.
      // Wenn nicht gefunden → ein generischer Rep-Task wie gehabt (Schedule
      //                       deckt evtl. nicht alle Wochen ab).
      let scheduleEntry: RepScheduleEntry | undefined;
      if (t.kind === "rep" && t.schedule) {
        scheduleEntry = t.schedule.find(s => s.date === dateStr);
      }

      // recurringKey: stabile ID pro (kind, label, date, slot) — egal wie der
      // Titel später durch Reverse-Flow umbenannt wird, der Key bleibt gleich.
      const mainKey = `${t.kind}|${recurringId(t)}|${dateStr}|main`;
      const mainTitle = scheduleEntry
        ? `${t.label} — ${scheduleEntry.title} (${t.durationHours}h)`
        : `${t.label} (${t.durationHours}h)`;

      if (dateStr <= end && t.durationHours > 0 && !covered(mainKey,t,dateStr,'main') && !existingDateTitle.has(`${dateStr}|${mainTitle}`)) {
        addTask({
          date: dateStr,
          title: mainTitle,
          durationMinutes: Math.round(t.durationHours * 60),
          source: "plan",
          recurringKey: mainKey,
          linkedTopicId: scheduleEntry?.topicIds[0],
          linkedTopicIds: scheduleEntry?.topicIds,
          contentSummary: scheduleEntry?.content,
        });
        existingKeySet.add(mainKey);

        created++;
      }

      if (t.prepHours > 0) {
        const prepDate = prepDateFor(t.kind, d);
        const prepKey = `${t.kind}|${recurringId(t)}|${dateStr}|prep`;
        const prepTitle = scheduleEntry
          ? `Vorb. ${t.label} — ${scheduleEntry.title} (${t.prepHours}h)`
          : `Vorb. ${t.label} (${t.prepHours}h)`;
        if (prepDate >= start && prepDate <= end && !covered(prepKey,t,dateStr,'prep') && !existingDateTitle.has(`${prepDate}|${prepTitle}`)) {
          addTask({
            date: prepDate,
            title: prepTitle,
            durationMinutes: Math.round(t.prepHours * 60),
            source: "plan",
            recurringKey: prepKey,
            linkedTopicId: scheduleEntry?.topicIds[0],
            linkedTopicIds: scheduleEntry?.topicIds,
            contentSummary: scheduleEntry?.content,
          });
          existingKeySet.add(prepKey);

          created++;
        }
      }
      if (t.postHours > 0 && dateStr <= end) {
        const postKey = `${t.kind}|${recurringId(t)}|${dateStr}|post`;
        const postTitle = scheduleEntry
          ? `Nachb. ${t.label} — ${scheduleEntry.title} (${t.postHours}h)`
          : `Nachb. ${t.label} (${t.postHours}h)`;
        if (!covered(postKey,t,dateStr,'post') && !existingDateTitle.has(`${dateStr}|${postTitle}`)) {
          addTask({
            date: dateStr,
            title: postTitle,
            durationMinutes: Math.round(t.postHours * 60),
            source: "plan",
            recurringKey: postKey,
            linkedTopicId: scheduleEntry?.topicIds[0],
            linkedTopicIds: scheduleEntry?.topicIds,
            contentSummary: scheduleEntry?.content,
          });
          existingKeySet.add(postKey);

          created++;
        }
      }
    }
  }

  return { created };
}

/**
 * Entfernt unerledigte Termin-Tasks im Range, die nicht mehr zum Rhythmus passen:
 * falsche Woche bei 14-tägig/monatlich (Altlast der früheren range-relativen
 * Paritätsberechnung), falscher Wochentag nach Termin-Umzug, außerhalb von
 * start-/endDate, oder der Termin existiert nicht mehr im Onboarding.
 * Erledigte Tasks bleiben immer erhalten (Historie). Klausur-Tasks
 * (recurringKey "klausur-written|…", 3 Teile) werden nie angefasst.
 */
function cleanupStaleRecurringTasks(termine: RecurringTermin[], start: string, end: string): void {
  const RECURRING_KINDS = new Set(["ag", "rep", "lerngruppe", "sonstiges"]);
  for (const task of getTasks()) {
    if (task.done || !task.recurringKey) continue;
    const parts = task.recurringKey.split("|");
    if (parts.length !== 4) continue;
    const [kind, label, dateStr] = parts;
    if (!RECURRING_KINDS.has(kind)) continue;
    if (task.date < start || task.date > end) continue; // nur im aktuellen Range aufräumen
    const t = termine.find((x) => x.kind === kind && (recurringId(x) === label || x.label === label));
    const slot = parts[3];
    let stale = false;
    if (!t) {
      stale = true;
    } else {
      const d = new Date(dateStr + "T00:00:00Z");
      if (!matchesTermin(t, d, termine)) stale = true;
      else {
        // Liegt der Task am erwarteten Datum? Vorb.-Tasks gehören auf den
        // Vortag (Lerngruppe: auf den Termintag selbst), main/post auf den
        // Termintag. Falsch datierte Altlasten raus — werden korrekt neu erzeugt.
        const expected = slot === "prep" ? prepDateFor(t.kind, d) : dateStr;
        if (task.date !== expected) stale = true;
      }
    }
    if (stale) removeTask(task.id);
  }
}

/**
 * Backfill: alte plan-Tasks ohne recurringKey, die wie Termine aussehen,
 * bekommen rückwirkend einen Key. Bei Duplikaten (gleicher Key) gewinnt die
 * Variante mit contentSummary (= manuell befüllt) bzw. die jüngere (createdAt).
 * Wird einmal bei jedem materializeRecurringTermine-Aufruf ausgeführt — billig
 * weil idempotent.
 */
function migrateAndDedupRecurringTasks(termine: RecurringTermin[]): void {
  const all = getTasks();
  // Pro Termin: Pattern für main/prep/post-Tasks
  // Beispiel: "Lerngruppe (2h)" oder "Lerngruppe (2h) — XY" → key=lerngruppe|Lerngruppe|date|main
  type Match = { kind: string; label: string; slot: "main" | "prep" | "post" };
  const tryMatch = (title: string): Match | null => {
    for (const tm of termine) {
      // Escape regex meta chars im Label
      const lbl = tm.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const main = new RegExp(`^${lbl}\\s*\\(`, "i");
      const prep = new RegExp(`^Vorb\\.\\s*${lbl}\\s*\\(`, "i");
      const post = new RegExp(`^Nachb\\.\\s*${lbl}\\s*\\(`, "i");
      if (post.test(title)) return { kind: tm.kind, label: recurringId(tm), slot: "post" };
      if (prep.test(title)) return { kind: tm.kind, label: recurringId(tm), slot: "prep" };
      if (main.test(title)) return { kind: tm.kind, label: recurringId(tm), slot: "main" };
    }
    return null;
  };

  // 1. Backfill recurringKey
  // WICHTIG: Der Key trägt immer das TERMIN-Datum. Alte Vorb.-Tasks sind aber
  // auf den Vortag datiert — deren Key-Datum muss um +1 Tag korrigiert werden,
  // sonst entstehen für denselben logischen Task zwei verschiedene Keys
  // (Ursache für doppelte "Vorb. Lerngruppe"-Tasks).
  for (const t of all) {
    if (t.source !== "plan") continue;
    if (t.recurringKey) continue;
    const m = tryMatch(t.title);
    if (!m) continue;
    let keyDate = t.date;
    if (m.slot === "prep" && m.kind !== "lerngruppe") {
      const next = new Date(t.date + "T00:00:00Z");
      next.setUTCDate(next.getUTCDate() + 1);
      keyDate = isoDate(next);
    }
    const key = `${m.kind}|${m.label}|${keyDate}|${m.slot}`;
    updateTask(t.id, { recurringKey: key });
  }

  // 2. Dedupe nach Backfill: pro recurringKey nur eine Task behalten
  //    Bevorzugung: erstens done, zweitens mit contentSummary, drittens neuer
  const fresh = getTasks();
  const byKey = new Map<string, typeof fresh>();
  for (const t of fresh) {
    if (!t.recurringKey) continue;
    const list = byKey.get(t.recurringKey) || [];
    list.push(t);
    byKey.set(t.recurringKey, list);
  }
  for (const [, list] of byKey) {
    if (list.length <= 1) continue;
    // Sort: done desc, hasContent desc, createdAt desc → behalten = [0]
    list.sort((a, b) => {
      const ad = a.done ? 1 : 0;
      const bd = b.done ? 1 : 0;
      if (ad !== bd) return bd - ad;
      const ac = a.contentSummary ? 1 : 0;
      const bc = b.contentSummary ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
    for (let i = 1; i < list.length; i++) {
      if (!list[i].done) removeTask(list[i].id);
    }
  }
}


 return materializeRecurringTermine(start,end);
}
export interface ApplyResult {
  tasksCreated: number;
  klausurenCreated: number;
  klausurenSkipped: number;
  moved: number;
  deferred: number;
  warnings: string[];
  createdTaskIds: string[];
  createdEventIds: string[];
  before: PlanningSnapshot;
  after: PlanningSnapshot;
}

/** Commit a capacity-checked plan. No task disappears when a day is full. */
export function applyPlanWithAdapter(input: StructuredPlan, adapter: PlanDataAdapter, today = localDate()): ApplyResult {
  const {getOnboarding,getKlausuren,getTasks,getCalendarEvents,writeSnapshot,snapshot,newId,now}=adapter;
  const materializeRecurringTermine=(start:string,end:string)=>materializeRecurringWithAdapter(adapter,start,end);
  const plan = validateStructuredPlan(input);
  if (!plan) throw new Error("Der Plan enthält ungültige Daten oder Zeitangaben. Bitte neu erstellen lassen.");
  const content = plan.tasks.filter(task => !isTerminTitle(task.title));
  const dates = [...content.map(task => task.date), ...plan.klausuren.map(exam => exam.date)].sort();
  if (!dates.length) throw new Error("Der Plan enthält keine übernehmbaren Lernaufgaben.");
  if (dates[0] < today) throw new Error("Der Plan enthält vergangene Tage. Bitte einen Plan ab heute erstellen lassen.");
  if (differenceInCalendarDays(parseISO(dates.at(-1)!), parseISO(today)) > 366) throw new Error("Bitte zunächst höchstens die nächsten zwölf Monate konkret planen.");
  const settings = getOnboarding();
  const rangeStart = dates[0];
  const sourceNames = new Set(settings.documents.filter(document => document.fullText?.trim()).map(document => document.name));
  for (const item of [...(plan.studyPhases ?? []), ...(plan.appointments ?? [])]) {
    if (!item.sourceDocument || !sourceNames.has(item.sourceDocument)) throw new Error(`Die Quelle „${item.sourceDocument ?? "unbekannt"}“ fehlt oder hat keinen lesbaren Dokumenttext. Bitte den Plan prüfen.`);
  }
  const knownCases = new Map(getKlausuren().map(exam => [exam.id, exam]));
  for (const exam of plan.klausuren) if (exam.klausurId && (!knownCases.has(exam.klausurId) || knownCases.get(exam.klausurId)!.area !== exam.area)) throw new Error("Eine zugeordnete Klausur fehlt in der Datenbank oder hat ein anderes Rechtsgebiet.");
  const requestedEnd = dates.at(-1)!;
  if (isDateOnly(settings.examDate) && requestedEnd >= settings.examDate) throw new Error("Lernaufgaben müssen vor deinem Prüfungstermin liegen. Bitte Plan oder Prüfungstermin korrigieren.");
  // Leave up to four weeks for overflow; never schedule past the exam.
  const rangeEnd = planningEnd(requestedEnd, settings, 28);
  const before = snapshot();
  const result: ApplyResult = { tasksCreated: 0, klausurenCreated: 0, klausurenSkipped: 0, moved: 0, deferred: 0, warnings: [], createdTaskIds: [], createdEventIds: [], before, after: before };
  try {
    const updatedSettings = { ...settings, ...(plan.studyPhases?.length ? { studyPhases: plan.studyPhases } : {}) };
    adapter.setOnboarding(updatedSettings);
    materializeRecurringTermine(rangeStart, rangeEnd);
    let tasks = getTasks().filter(task => task.done || task.deferred || task.source === "manual" || adapter.protectedTaskIds?.has(task.id) || (adapter.mode==='account'&&task.source==='auto') || isFixedTask(task) || task.date < rangeStart || task.date > requestedEnd);
    const retainedEventIds = new Set(tasks.flatMap(task => task.calendarEventId ? [task.calendarEventId] : []));
    const events = getCalendarEvents().filter(event => retainedEventIds.has(event.id) || event.source !== "plan" || event.date < rangeStart || event.date > requestedEnd);
    for (const appointment of plan.appointments ?? []) {
      if (Math.abs(differenceInCalendarDays(parseISO(appointment.date), parseISO(today))) > 800) throw new Error("Ein Dokumenttermin liegt außerhalb des zweijährigen Ausbildungszeitraums. Bitte prüfen.");
      const existing = events.find(event => event.date === appointment.date && event.eventType === appointment.eventType && event.label === appointment.label);
      if (existing) continue;
      // A manually entered/profile appointment has priority over the extracted duplicate.
      if (eventsOnDate(events, appointment.date).some(event => event.eventType === appointment.eventType && event.source !== "document")) { result.warnings.push(`${appointment.date}: „${appointment.label}“ bitte mit dem vorhandenen Termin abgleichen; nicht zusätzlich übernommen.`); continue; }
      const profileTask = tasks.some(task => task.date === appointment.date && task.recurringKey?.startsWith(`${appointment.eventType}|`) && task.recurringKey.endsWith("|main"));
      if (profileTask) { result.warnings.push(`${appointment.date}: Dokumenttermin ist bereits im Profil eingeplant.`); continue; }
      if ((appointment.eventType === "ag" || appointment.eventType === "rep" || appointment.eventType === "sport" || appointment.eventType === "kaiser") && !appointment.durationMinutes) result.warnings.push(`${appointment.date}: Dauer für „${appointment.label}“ fehlt; bitte ergänzen, bevor du dich auf das Tagesbudget verlässt.`);
      const event: CalendarEvent = { ...appointment, id: newId(), recurring: false, source: "document" };
      events.push(event); result.createdEventIds.push(event.id);
    }
    const validTopics = new Set(getLeafTopics(TOPICS).map(topic => topic.id));
    const seen = new Set<string>();
    // Exam slots are placed first so content cannot consume their five hours.
    for (const exam of plan.klausuren) {
      if(adapter.mode==='account'&&tasks.some(task=>(task.date===exam.date||task.rescheduledFrom===exam.date)&&task.klausurMode!=='read'&&!/^Skizze\b/i.test(task.title)&&(exam.klausurId?task.linkedKlausurId===exam.klausurId:!task.linkedKlausurId&&task.title===exam.label&&task.klausurMode==='written'))){result.klausurenSkipped++;continue;}
      if ((adapter.mode==='account'&&events.some(event=>event.source==='plan'&&(event as CalendarEvent&{c3b1?:{requestedDate?:string}}).c3b1?.requestedDate===exam.date))||eventsOnDate(events, exam.date).some(event => event.eventType === "klausur" || event.eventType === "probeexamen")) { result.klausurenSkipped++; continue; }
      let date = exam.date;
      const event: CalendarEvent = { id: newId(), date, eventType: "klausur", label: exam.label, recurring: false, source: "plan", linkedKlausurId: exam.klausurId,...(adapter.mode==='account'?{durationMinutes:300,c3b1:{requestedDate:exam.date}}:{}) };
      while (date <= rangeEnd) {
        const dayEvents = eventsOnDate(planningEvents(events, settings), date);
        const dayTasks = tasks.filter(task => task.date === date && !task.deferred && (adapter.mode==='account' || task.done || task.source === "manual" || isFixedTask(task)));
        if (!isStudyFreeDay(date, settings, events) && !dayEvents.some(item => item.eventType === "klausur" || item.eventType === "probeexamen")
          && computeDayBudget(dayTasks, [...dayEvents, { ...event, date }], { maxHours: dailyHours(settings), suppressReserve: true }).overloadH === 0) break;
        date = localDate(addDays(parseISO(date), 1));
      }
      if (date > rangeEnd) {
        // Preserve an unschedulable exam as a visible backlog task.
        const task: DailyTask = { id: newId(), date: exam.date, title: exam.label, linkedKlausurId: exam.klausurId, klausurMode: "written", durationMinutes: 300, source: "plan", done: false, createdAt: now(), deferred: true,...(adapter.mode==='account'&&exam.klausurId?{recurringKey:`klausur-written|${exam.klausurId}|${exam.date}|written`}:{}) };
        tasks.push(task); result.createdTaskIds.push(task.id); result.tasksCreated++;
        continue;
      }
      if (date !== exam.date) result.moved++;
      events.push({ ...event, date }); result.createdEventIds.push(event.id); result.klausurenCreated++;
      if (exam.klausurId) {
        const task: DailyTask = { id: newId(), date, title: exam.label, linkedKlausurId: exam.klausurId, calendarEventId: event.id, klausurMode: "written", durationMinutes: 300, source: "plan", done: false, createdAt: now(),...(adapter.mode==='account'?{recurringKey:`klausur-written|${exam.klausurId}|${exam.date}|written`,...(date!==exam.date?{rescheduledFrom:exam.date}:{})}:{}) };
        tasks.push(task); result.createdTaskIds.push(task.id); result.tasksCreated++;
      }
    }
    for (const task of content) {
      const key = `${task.date}|${task.title.toLocaleLowerCase()}`;
      if (seen.has(key) || tasks.some(item => item.date === task.date && item.title.toLocaleLowerCase() === task.title.toLocaleLowerCase())) continue;
      seen.add(key);
      const item: DailyTask = { id: newId(), date: task.date, title: task.title, linkedTopicId: task.topicId && validTopics.has(task.topicId) ? task.topicId : undefined, isReview: task.isReview, durationMinutes: task.minutes ?? 90, source: "plan", done: false, createdAt: now() };
      tasks.push(item); result.createdTaskIds.push(item.id); result.tasksCreated++;
    }
    const repaired = rebalanceTasks(tasks, planningEvents(events, settings), settings, rangeStart, rangeEnd, adapter.mode==='account'?{preserveSuggestions:true,movableIds:new Set(result.createdTaskIds)}:undefined);
    tasks = repaired.tasks;
    result.moved += repaired.moved.length; result.deferred = repaired.deferred.length;
    const actualDates = [...tasks.filter(task => result.createdTaskIds.includes(task.id) && !task.deferred).map(task => task.date), ...events.filter(event => event.source !== "document" && result.createdEventIds.includes(event.id)).map(event => event.date)];
    const actualEnd = [...actualDates, requestedEnd].sort().at(-1)!;
    const allEvents = planningEvents(events, settings);
    // Calendar-only conflicts also matter. Distant source dates are checked
    // without marking all intervening months as a concretely applied plan.
    const warningDates = new Set((plan.appointments ?? []).filter(item => item.date >= today).map(item => item.date));
    for (let date = rangeStart; date <= actualEnd; date = localDate(addDays(parseISO(date), 1))) warningDates.add(date);
    for (const date of [...warningDates].sort()) {
      const budget = computeDayBudget(tasks.filter(task => task.date === date), eventsOnDate(allEvents, date), { maxHours: dailyHours(settings), suppressReserve: true });
      if (budget.overloadH > 0) result.warnings.push(`${date}: feste oder manuelle Aufgaben liegen ${budget.overloadH.toFixed(1)} h über der Tagesgrenze.`);
      if (budget.totalH > 0 && isStudyFreeDay(date, settings, allEvents)) result.warnings.push(`${date}: feste oder manuelle Verpflichtungen fallen auf einen freien Tag. Bitte den Konflikt klären; feste Termine wurden nicht verschoben.`);
    }
    result.after = { tasks, events, range: { start: rangeStart, end: actualEnd, appliedAt: now() }, onboarding: updatedSettings };
    writeSnapshot(result.after);
    return result;
  } catch (error) {
    writeSnapshot(before);
    throw error;
  }
}

