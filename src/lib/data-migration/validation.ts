import type { Issue, JsonObject, JsonValue, LegacyBackup, MigrationContext } from "./contract";
import { BACKUP_AREAS, excludedArea } from "./inventory";

export class MigrationValidationError extends Error {
  constructor(public readonly issues: Issue[]) {
    super(`Migration nicht möglich: ${issues.length} ungültige Datenangabe(n).`);
    this.name = "MigrationValidationError";
  }
}
export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
const credentialKey = /^(?:api[-_]?key|openrouter[-_].*key|password|passwd|secret|secrets|access[-_]?token|refresh[-_]?token|authorization|cookie|session[-_]?token)$/i;
const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);
const areasByKey = new Map(BACKUP_AREAS.map(area => [area.key, area]));
const enums: Record<string, readonly string[]> = {
  area: ["zr", "oeffr", "sr"],
  eventType: ["ag", "rep", "kaiser", "probeexamen", "urlaub", "frei", "sport", "klausur"],
  activityType: ["theorie", "klausur", "wiederholung", "karteikarten", "ag", "rep"],
  klausurMode: ["written", "read"],
  recallRating: ["again", "hard", "good", "easy"],
};

class Validator {
  issues: Issue[] = [];
  add(code: string, path: string, message: string) { this.issues.push({ code, path, message }); }
  field(value: JsonObject, key: string, type: "string" | "number" | "boolean" | "array" | "object", path: string, optional = false) {
    if (optional && value[key] === undefined) return;
    const item = value[key];
    const valid = type === "array" ? Array.isArray(item) : type === "object" ? isObject(item)
      : typeof item === type && (type !== "number" || Number.isFinite(item));
    if (!valid) this.add("field-type", `${path}.${key}`, `Feld erwartet ${type}.`);
  }
  choice(value: JsonObject, key: string, choices: readonly string[], path: string, optional = false) {
    if (optional && value[key] === undefined) return;
    if (typeof value[key] !== "string" || !choices.includes(value[key])) this.add("enum", `${path}.${key}`, "Unbekannte technische Kennung.");
  }
  date(value: JsonObject, key: string, path: string, optional = false) {
    if (optional && value[key] === undefined) return;
    if (!isDate(value[key])) this.add("date", `${path}.${key}`, "Gültiges Kalenderdatum erforderlich.");
  }
  json(value: unknown, path: string, ancestors = new Set<object>(), depth = 0): void {
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (!value || typeof value !== "object" || depth > 60 || ancestors.has(value)) {
      this.add("json", path, "Endliche, azyklische JSON-Daten erforderlich."); return;
    }
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      this.add("json", path, "Einfaches JSON-Objekt erforderlich."); return;
    }
    ancestors.add(value);
    for (const [key, item] of Object.entries(value)) {
      if (unsafeKeys.has(key)) this.add("unsafe-key", path, "Reservierter Objektschlüssel ist nicht erlaubt.");
      else if (credentialKey.test(key)) this.add("credential", path, "Zugangsdaten dürfen nicht migriert werden.");
      else if (key === "ownerUserId" || key === "userId") this.add("ownership", path, "Eigentümerzuordnung muss außerhalb des Backups erfolgen.");
      else this.json(item, `${path}.${key}`, ancestors, depth + 1);
    }
    ancestors.delete(value);
  }
  strings(value: JsonObject, keys: string[], path: string) { for (const key of keys) this.field(value, key, "string", path); }
  list(value: JsonValue, path: string, validate: (item: JsonObject, itemPath: string) => void, optionalId = false) {
    if (!Array.isArray(value)) { this.add("list", path, "Liste erforderlich."); return; }
    const ids = new Set<string>();
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (!isObject(item)) { this.add("record", itemPath, "Datensatz muss ein Objekt sein."); return; }
      if (!optionalId || item.id !== undefined) {
        if (typeof item.id !== "string" || !item.id.trim()) this.add("id", `${itemPath}.id`, "Stabile ID erforderlich.");
        else if (ids.has(item.id)) this.add("id-collision", `${itemPath}.id`, "ID kommt mehrfach vor; keine automatische Zusammenführung.");
        else ids.add(item.id);
      }
      validate(item, itemPath);
    });
  }
  record(kind: string, value: JsonObject, path: string) {
    const commonTime = () => this.field(value, "createdAt", "string", path);
    switch (kind) {
      case "klausur":
        this.strings(value, ["source", "title", "createdAt", "updatedAt"], path);
        this.choice(value, "area", enums.area, path);
        this.field(value, "topicIds", "array", path);
        this.field(value, "type", "string", path, true); // preserve old classifications verbatim
        if (value.date !== undefined && value.date !== null && value.date !== "") this.date(value, "date", path);
        break;
      case "learning-entry":
        this.strings(value, ["topicId", "note"], path); commonTime();
        this.choice(value, "source", ["chat", "manual", "upload"], path); break;
      case "calendar-event":
        this.date(value, "date", path); this.field(value, "label", "string", path);
        this.choice(value, "eventType", enums.eventType, path); this.field(value, "recurring", "boolean", path);
        this.field(value, "recurringDay", "number", path, true);
        if (value.recurring && (!Number.isInteger(value.recurringDay) || Number(value.recurringDay) < 0 || Number(value.recurringDay) > 6)) this.add("recurrence", path, "Wiederkehrender Termin benötigt Wochentag 0 bis 6.");
        break;
      case "tracking-entry":
        this.date(value, "date", path); commonTime(); this.field(value, "note", "string", path);
        this.field(value, "durationMinutes", "number", path); this.field(value, "topicIds", "array", path);
        this.choice(value, "activityType", enums.activityType, path);
        this.choice(value, "recallRating", enums.recallRating, path, true);
        this.choice(value, "klausurMode", enums.klausurMode, path, true); break;
      case "task":
        this.date(value, "date", path); commonTime(); this.field(value, "title", "string", path);
        this.field(value, "done", "boolean", path); this.choice(value, "source", ["auto", "manual", "plan"], path);
        this.choice(value, "klausurMode", enums.klausurMode, path, true); break;
      case "draft":
        this.strings(value, ["title", "contentHtml", "contentText", "createdAt", "updatedAt"], path);
        this.list(value.feedback, `${path}.feedback`, (entry, entryPath) => {
          this.strings(entry, ["scope", "feedbackText", "model", "createdAt"], entryPath);
          this.field(entry, "markers", "array", entryPath);
        }); break;
      case "document":
        this.strings(value, ["name", "type", "dataUrl", "uploadedAt"], path);
        this.field(value, "size", "number", path); this.field(value, "tags", "array", path);
        this.field(value, "includeInNextPlan", "boolean", path);
        if (!Array.isArray(value.tags) || value.tags.some(tag => typeof tag !== "string")) this.add("tags", path, "Dokumenttags müssen Zeichenketten sein.");
        break;
      case "prompt":
        this.strings(value, ["label", "description", "prompt"], path);
        this.choice(value, "modelTier", ["premium", "strong", "cheap"], path);
        this.field(value, "contextFlags", "array", path); break;
      case "plan-history":
        this.strings(value, ["reply", "createdAt"], path);
        if (value.structured !== null && !isObject(value.structured)) this.add("plan", `${path}.structured`, "Planobjekt oder null erforderlich.");
        break;
      case "progress":
        this.strings(value, ["topicId", "updatedAt"], path); this.field(value, "percent", "number", path);
        if (Number(value.percent) < 0 || Number(value.percent) > 100) this.add("percent", path, "Fortschritt muss zwischen 0 und 100 liegen.");
        this.choice(value, "source", ["manual", "ai", "upload", "klausur"], path); break;
      case "ag-week":
        this.field(value, "weekKey", "string", path); this.field(value, "agDays", "array", path);
        this.choice(value, "source", ["default", "manual", "ai"], path);
        if (!Array.isArray(value.agDays) || value.agDays.some(day => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6)) this.add("ag-days", path, "AG-Tage müssen Ganzzahlen 0 bis 6 sein."); break;
    }
    for (const key of ["durationMinutes", "rating", "recurringDay"]) if (value[key] !== undefined) this.field(value, key, "number", path);
    if (value.durationMinutes !== undefined && Number(value.durationMinutes) < 0) this.add("duration", path, "Negative Dauer ist nicht zulässig.");
  }
  objectArea(kind: string, value: JsonObject, path: string) {
    if (kind === "profile") {
      for (const key of ["ags", "lerngruppen", "reps", "sonstiges", "studyPhases"]) if (value[key] !== undefined) this.list(value[key], `${path}.${key}`, () => {});
      if (value.documents !== undefined) this.list(value.documents, `${path}.documents`, (item, p) => this.strings(item, ["name", "type"], p), true);
      if (value.selfAssessment !== undefined) this.field(value, "selfAssessment", "object", path);
      for (const key of ["completed", "studyPhasesEnabled"]) this.field(value, key, "boolean", path, true);
      for (const key of ["notes", "examDate", "lernstart"]) this.field(value, key, "string", path, true);
    } else if (kind === "notepad") this.strings(value, ["html", "text", "updatedAt"], path);
    else if (kind === "correction-settings") {
      this.field(value, "model", "string", path, true);
      this.choice(value, "granularity", ["manuell", "wort", "satz", "absatz"], path, true);
    } else if (kind === "plan-range") {
      this.date(value, "start", path); this.date(value, "end", path); this.field(value, "appliedAt", "string", path);
      if (typeof value.start === "string" && typeof value.end === "string" && value.start > value.end) this.add("range", path, "Zeitraum ist umgekehrt.");
    } else if (kind === "recommender-settings" || kind === "ai-metrics") {
      for (const key of Object.keys(value)) this.field(value, key, "number", path);
    } else if (kind === "reasoning-settings") {
      for (const key of Object.keys(value)) this.choice(value, key, ["provider", "none", "low", "medium", "high", "xhigh", "max"], path);
    } else if (kind === "error-profile") {
      this.field(value, "markers", "object", path); this.field(value, "updatedAt", "string", path);
      if (isObject(value.markers)) for (const [key, entry] of Object.entries(value.markers)) {
        if (!isObject(entry)) this.add("marker", `${path}.markers.${key}`, "Markerobjekt erforderlich.");
        else { this.strings(entry, ["label", "lastSeen"], `${path}.markers.${key}`); this.field(entry, "count", "number", `${path}.markers.${key}`); }
      }
    }
  }
}

/** Check shapes without repairing, dropping fields, renaming IDs, or executing text. */
export function validateBackup(input: unknown, context: MigrationContext): LegacyBackup {
  const v = new Validator();
  if (typeof context.ownerUserId !== "string" || !context.ownerUserId.trim()) v.add("owner", "context", "Zugeordneter Eigentümer erforderlich.");
  if (!Array.isArray(context.topicIds) || context.topicIds.some(id => typeof id !== "string" || !id)) v.add("topics", "context", "Verbindliche Themenkennungen erforderlich.");
  if (!isObject(input) || input.version !== 1 || !isObject(input.data)) throw new MigrationValidationError([{ code: "format", path: "backup", message: "BackupBundle Version 1 mit Datenobjekt erforderlich." }]);
  if (typeof input.exportedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(input.exportedAt) || !Number.isFinite(Date.parse(input.exportedAt))) v.add("export-date", "backup.exportedAt", "Exportzeitpunkt fehlt oder ist ungültig.");
  const data: JsonObject = {};
  for (const [key, value] of Object.entries(input.data)) {
    if (excludedArea(key)) continue;
    const area = areasByKey.get(key);
    if (!area) { v.add(credentialKey.test(key) ? "credential" : "unknown-area", "backup.data", "Unbekannter oder nicht exportierbarer Speicherbereich; nichts stillschweigend verwerfen."); continue; }
    const path = `backup.data.${key}`;
    v.json(value, path);
    const valid = area.shape === "list" ? Array.isArray(value) : area.shape === "string" ? typeof value === "string"
      : area.shape === "nullable-object" && value === null ? true : isObject(value);
    if (!valid) { v.add("area-shape", path, "Speicherbereich hat eine ungültige Form."); continue; }
    data[key] = value;
    if (area.shape === "list") v.list(value, path, (item, itemPath) => v.record(area.kind, item, itemPath));
    else if (area.shape === "map" && isObject(value)) for (const [id, item] of Object.entries(value)) {
      if (!id.trim() || !isObject(item)) { v.add("map-record", `${path}.${id}`, "Kartenwert muss ein Datensatz mit stabiler Kennung sein."); continue; }
      v.record(area.kind, item, `${path}.${id}`);
      if ((area.kind === "progress" && item.topicId !== id) || (area.kind === "ag-week" && item.weekKey !== id)) v.add("map-id", `${path}.${id}`, "Kartenschlüssel und Datensatzkennung stimmen nicht überein.");
    }
    else if (isObject(value)) v.objectArea(area.kind, value, path);
    if ((area.kind === "exam-date" || area.kind === "learning-start") && value !== "" && !isDate(value)) v.add("date", path, "Datum muss unbekannt oder gültig sein.");
  }
  if (!Object.keys(data).length) v.add("empty", "backup.data", "Keine dauerhaften Datenbereiche vorhanden.");
  if (v.issues.length) throw new MigrationValidationError(v.issues);
  return structuredClone({ version: 1, exportedAt: input.exportedAt, data }) as LegacyBackup;
}

export function validateReferences(backup: LegacyBackup, context: MigrationContext, available: { klausur: Set<string>; calendar: Set<string>; tracking: Set<string> }): void {
  const v = new Validator();
  const topics = new Set(context.topicIds);
  const fields: Record<string, Set<string>> = { klausurId: available.klausur, linkedKlausurId: available.klausur,
    calendarEventId: available.calendar, trackingEntryId: available.tracking, topicId: topics, linkedTopicId: topics };
  function visit(value: JsonValue, path: string): void {
    if (Array.isArray(value)) { value.forEach((item, i) => visit(item, `${path}[${i}]`)); return; }
    if (!isObject(value)) return;
    for (const [field, item] of Object.entries(value)) {
      if (fields[field] && (typeof item !== "string" || !fields[field].has(item))) v.add("broken-reference", `${path}.${field}`, "Ziel der Verknüpfung fehlt; keine automatische Umleitung.");
      if (field === "topicIds" || field === "linkedTopicIds") {
        if (!Array.isArray(item) || item.some(id => typeof id !== "string" || !topics.has(id))) v.add("broken-topic", `${path}.${field}`, "Mindestens eine Themenkennung fehlt im Themenbaum.");
      }
      if (field === "selfAssessment" && isObject(item)) for (const id of Object.keys(item)) if (!topics.has(id)) v.add("broken-topic", `${path}.${field}`, "Selbsteinschätzung enthält unbekannte Themenkennung.");
      visit(item, `${path}.${field}`);
    }
  }
  visit(backup.data, "backup.data");
  const profile = backup.data["lerntracker-onboarding"];
  if (isObject(profile) && Array.isArray(profile.reps)) for (const rep of profile.reps) if (isObject(rep) && rep.scheduleDocIndex !== undefined) {
    if (!Number.isInteger(rep.scheduleDocIndex) || Number(rep.scheduleDocIndex) < 0 || !Array.isArray(profile.documents) || Number(rep.scheduleDocIndex) >= profile.documents.length) v.add("broken-document-index", "backup.data.lerntracker-onboarding.reps", "Dokumentindex liegt außerhalb der erhaltenen Dokumentliste.");
  }
  if (v.issues.length) throw new MigrationValidationError(v.issues);
}
