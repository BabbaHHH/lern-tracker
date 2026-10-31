@AGENTS.md

# Stex Tracker — Projektüberblick

Lern-Tracker-App für das **2. juristische Staatsexamen Berlin (GJPA)**, Examenstermin Oktober/November 2026. Nutzer ist Jura-Referendar, Coding-Anfänger.

## Stack
- **Next.js 16** App Router, TypeScript, Tailwind v4
- **Persistenz**: ausschließlich `localStorage` (kein Backend, kein Supabase)
- **KI**: OpenRouter API — Opus 4.6 (premium) für Lernplan, Haiku/Sonnet (cheap) für Check-in-Chat
- Dev-Server: `npm run dev` in `/lern-tracker`, Port 3000
  - Standard `npm run dev` läuft jetzt über `scripts/dev.sh`: killt alte Port-3000-Prozesse, setzt RAM-Limit, **auto-restart-Loop bei Crash**.
  - `npm run dev:clean` → zusätzlich `.next` löschen (bei Turbopack-Korruption)
  - `npm run dev:webpack` → Webpack statt Turbopack (langsamer aber bombenfest)
  - `npm run dev:plain` → das alte direkte `next dev` (für Fälle wo das Wrapper-Skript stört)

## Kernarchitektur

### Datenhaltung (`src/lib/store.ts`)
Alle Daten in localStorage: `TrackingEntry[]`, `Klausur[]`, `CalendarEvent[]`, `Progress` (topicId → percent), `LearningEntry[]`. Backup/Restore via JSON-Export.

### Themen-Taxonomie (`src/lib/topics.ts`)
4-Ebenen-Hierarchie: **Rechtsgebiet → Mat/Proz → Subkategorie → Leaf** (~395 Leaves).
- `zr` / `oeffr` / `sr` (Roots)
- Level-2: `zr-mat`, `zr-proz`, `or-mat`, `or-proz`, `sr-mat`, `sr-proz-allg`, `sr-proz-typ`
- Level-3: Subkategorien (z.B. `zr-mat-at`, `sr-proz-bvv`, `sr-proz-rev-abs`)
- Level-4: Leafs mit §-Referenz (z.B. `zr-mat-at-anfechtung-119ff`, `sr-proz-bvv-widerspruchsloesung`)

Hilfsfunktionen: `getLeafTopics(TOPICS)`, `buildTopicTree(TOPICS)`.

### KI-Prompts (`src/lib/prompts.ts` + `src/lib/prompt-context.ts`)
Prompt-System mit ContextFlags: `buildContextFor(flags[])` sammelt Kontext je nach Bedarf (topics, tracking, klausuren, calendar). Prompts sind editierbar via PromptGear-UI.

### Topic-Grid (`src/components/topic-grid.tsx`)
6 Säulen (PILLARS), jede mit Level-3-groupIds. Zweistufiges Akkordeon: Gruppe → Leafs mit Progress-Slider.

### Klausur-Datenbank (`src/app/klausuren/page.tsx`)
Klausuren mit `KlausurType` (ZR/OR/SR-spezifisch), `topicIds[]`, `difficulty`, Sachverhalt, Lösung etc.

### Klausurtypen (`src/lib/types.ts`)
```
ZR: Urteil | Beschluss | Anwaltsklausur | Kautelarklausur
OR: Urteil | Beschluss | Anwaltsklausur | Behördenklausur
SR: Anklageklausur | Revisionsklausur | Plädoyer | Haftklausur | Einspruch Strafbefehl | Abschlussverfügung
```

## Wichtige Designentscheidungen
- **SR Prozessual** ist in zwei Zweige aufgeteilt: `sr-proz-allg` (allgemeine StPO-Probleme: VH, Zust, BVV, Erm, Haft, Einz) und `sr-proz-typ` (klausurtyp-spezifisch: StA, Rev, Klausurtypen)
- **Keine Datenmigration** — alte localStorage-Progress-IDs bleiben gespeichert aber werden ignoriert wenn die ID nicht mehr existiert
- **Backup-Reminder** alle 3 Tage (Banner auf Startseite)
- **Calendar circularity** verhindert: `buildCalendar()` filtert `eventType === "klausur"` heraus
