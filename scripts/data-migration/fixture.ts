import type { LegacyBackup, MigrationContext } from "../../src/lib/data-migration/contract";
import { TOPICS } from "../../src/lib/topics";

export const TEST_OWNER = "data-a-example-owner";
export const TEST_TOPIC = "zr-mat-at-vertragsschluss-145ff";
export function fixtureContext(ownerUserId = TEST_OWNER): MigrationContext {
  return { ownerUserId, topicIds: TOPICS.map(topic => topic.id) };
}
/** Entirely invented data. No browser, local document, credential or portal reads. */
export function fixtureBackup(): LegacyBackup {
  const stamp = "2026-10-10T10:00:00.000Z";
  const dataUrl = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\nSynthetic DATA-A bytes; not a rendered PDF.\n%%EOF\n").toString("base64")}`;
  const plan = { tasks: [{ date: "2026-10-12", title: "Vertragsschluss wiederholen", topicId: TEST_TOPIC, minutes: 30 }],
    klausuren: [{ date: "2026-10-12", label: "Übungsfall", area: "zr", klausurId: "example-case" }] };
  return { version: 1, exportedAt: stamp, data: {
    "lerntracker-progress": { [TEST_TOPIC]: { topicId: TEST_TOPIC, percent: 45, source: "manual", updatedAt: stamp } },
    "lerntracker-entries": [{ id: "note-1", topicId: TEST_TOPIC, note: "Meine persönliche Lernnotiz", source: "manual", createdAt: stamp }],
    "lerntracker-calendar": [{ id: "event-1", date: "2026-10-12", eventType: "klausur", label: "Übungsfall", recurring: false,
      linkedKlausurId: "example-case", source: "document", sourceDocument: "Beispiel-Stationsplan.pdf" }],
    "lerntracker-exam-date": "2027-04-01",
    "lerntracker-klausuren": [{ id: "example-case", source: "ZR Beispiel.pdf", date: "", title: "Vertragsschluss", area: "zr",
      type: "ZR-Urteil", topicIds: [TEST_TOPIC], createdAt: stamp, updatedAt: stamp, legacyAnalysis: { priority: "hoch" } }],
    "lerntracker-tracking": [{ id: "tracking-1", date: "2026-10-12", activityType: "klausur", topicIds: [TEST_TOPIC],
      klausurId: "example-case", klausurMode: "written", durationMinutes: 300, rating: 3, recallRating: "good", note: "Mein Rückblick", createdAt: stamp }],
    "lerntracker-recommender-weights": { schwacheThemen: 20, kuerzlichGeschrieben: -50 },
    "lerntracker-lernstart": "2026-10-01",
    "lerntracker-onboarding": { completed: true, bundesland: "Berlin", examDate: "2027-04-01", lernstart: "2026-10-01", notes: "Meine Planung",
      ags: [{ id: "ag-1", label: "AG", day: "Montag", frequency: "wöchentlich", durationHours: 4, prepHours: 1, postHours: 1, startDate: "", endDate: "" }],
      lerngruppen: [], reps: [{ id: "rep-1", label: "Rep", scheduleDocIndex: 0, schedule: [{ date: "2026-10-12", title: "Vertrag", topicIds: [TEST_TOPIC] }] }],
      sonstiges: [], studyPhases: [{ id: "phase-1", label: "Zivilstation", focus: "zr", perspective: "state", start: "2026-10-01", end: "2026-12-31", sourceDocument: "Beispiel-Stationsplan.pdf" }],
      documents: [{ id: "onb-doc-1", name: "Beispiel-Stationsplan.pdf", type: "application/pdf", fullText: "Persönlicher Quelltext des Beispiels", parseStatus: "ready" }],
      selfAssessment: { [TEST_TOPIC]: 40 } },
    "lerntracker-onboarding-airesult": { result: "Gespeicherte Beispielantwort", structured: plan },
    "lerntracker-theme": "indigo",
    "lerntracker-ag-weeks": { "2026-W42": { weekKey: "2026-W42", agDays: [0], source: "manual" } },
    "lerntracker-documents": [{ id: "doc-1", name: "Private Beispieldatei.pdf", type: "application/pdf", size: Buffer.from(dataUrl.split(",")[1], "base64").byteLength,
      dataUrl, uploadedAt: stamp, tags: ["eigene Notizen"], includeInNextPlan: true, textContent: "Ein verkürzter Beispieltext" }],
    "lerntracker-tasks": [{ id: "task-1", date: "2026-10-12", title: "Übungsfall schreiben", done: true, doneAt: stamp, source: "plan", createdAt: stamp,
      linkedKlausurId: "example-case", linkedTopicIds: [TEST_TOPIC], calendarEventId: "event-1", trackingEntryId: "tracking-1", klausurMode: "written", durationMinutes: 300, recurringKey: "ag|ag-1|2026-10-12|main", deferred: false }],
    "lerntracker-ai-metrics": { proposalsAccepted: 1, proposalsRejected: 0, plansApplied: 1, plansUndone: 0 },
    "lerntracker-prompts": [{ id: "custom-prompt", label: "Mein Prompt", description: "Beispiel", modelTier: "cheap", prompt: "Mein eigener Beispielprompt", contextFlags: ["progress"] }],
    "lerntracker-plan-history": [{ id: "history-1", createdAt: stamp, reply: "Gespeicherte Beispielplanung", structured: plan }],
    "lerntracker-plan-applied-range": { start: "2026-10-12", end: "2026-10-25", appliedAt: stamp },
    "lerntracker-klausur-drafts": [{ id: "draft-1", title: "Meine Lösung", klausurId: "example-case", sachverhalt: "Privat eingefügter Sachverhalt", contentHtml: "<p>Meine private Lösung</p>", contentText: "Meine private Lösung", createdAt: stamp, updatedAt: stamp,
      feedback: [{ id: "feedback-1", scope: "gesamt", feedbackText: "Ein erfundenes Beispiel für Feedback", model: "example/model", createdAt: stamp, markers: [{ key: "aufbau", label: "Aufbau" }] }] }],
    "lerntracker-fehlerprofil": { markers: { aufbau: { label: "Aufbau", count: 1, trend: "neu", lastSeen: stamp, byType: { Urteil: 1 } } }, updatedAt: stamp },
    "lerntracker-korrektur-settings": { model: "example/model", granularity: "manuell" },
    "lerntracker-plan-model": "example/plan-model",
    "lerntracker-ai-reasoning": { "example/plan-model": "high" },
    "lerntracker-freitext": { html: "<p>Meine freie Notiz</p>", text: "Meine freie Notiz", updatedAt: stamp },
  } };
}
