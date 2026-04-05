# Stex Tracker — Lebende Projekt-Bibel

**Intelligenter Lernfortschritts-Tracker für das 2. juristische Staatsexamen (Berlin/GJPA)**

Repository: [github.com/BabbaHHH/lern-tracker](https://github.com/BabbaHHH/lern-tracker)

---

## Inhaltsverzeichnis

1. [Projektziel](#1-projektziel)
2. [Prüfungskontext](#2-prüfungskontext)
3. [Tech-Stack](#3-tech-stack)
4. [Projektstruktur](#4-projektstruktur)
5. [Features (aktuell — Phase 2)](#5-features-aktuell--phase-2)
6. [Geplante Features](#6-geplante-features)
7. [Didaktische Grundprinzipien](#7-didaktische-grundprinzipien)
8. [Datenmodell](#8-datenmodell)
9. [KI-Architektur (3-Tier)](#9-ki-architektur-3-tier)
10. [Setup & Entwicklung](#10-setup--entwicklung)
11. [Deployment](#11-deployment)
12. [Entscheidungsprotokoll](#12-entscheidungsprotokoll)

---

## 1. Projektziel

Der Stex Tracker ist ein persönlicher, KI-gestützter Lernbegleiter speziell für die Vorbereitung auf das **2. juristische Staatsexamen** in Berlin (GJPA). Er ersetzt Tabellen, Notizzettel und manuelle Wochenpläne durch ein intelligentes System, das:

- den Lernfortschritt über ~110 Themen hinweg granular verfolgt,
- evidenzbasierte Lernstrategien (Spaced Repetition, Interleaving, Active Recall) automatisch umsetzt,
- wöchentliche Pläne dynamisch anpasst,
- und abends per KI-Chat reflektiert, was gut lief und was morgen priorisiert werden soll.

**Zielgruppe**: Primär Eigenentwicklung für einen einzelnen Kandidaten; in Phase 3 erweiterbar auf eine 5-köpfige Lerngruppe.

---

## 2. Prüfungskontext

| Parameter | Wert |
|---|---|
| Prüfung | 2. juristisches Staatsexamen Berlin (GJPA) |
| Klausurtermin | **03.09.2026** |
| Lernstart | **06.04.2026** |
| Lernzeit | ~21 Wochen |
| Klausurformat | 7 Klausuren: 3× Zivilrecht, 2× Öffentliches Recht, 2× Strafrecht |
| Mündliche Prüfung | Aktenvortrag |

### Lernphasen (Phasenmodell)

| Phase | Inhalt | Ziel |
|---|---|---|
| **Aufbau** | Schemata lernen, Grundstrukturen festigen | Breites Fundament |
| **Output** | Klausuren schreiben, Problemfelder trainieren | Anwendung unter Zeitdruck |
| **Puffer** | Schwachstellen gezielt schließen | Kalibrierung |
| **Tapering** | Wiederholung, kein neues Material | Stabilisierung vor Prüfung |

---

## 3. Tech-Stack

| Bereich | Technologie | Status |
|---|---|---|
| Frontend-Framework | Next.js 16 + TypeScript | Aktiv |
| Styling | Tailwind CSS + shadcn/ui | Aktiv |
| Datenpersistenz | localStorage | Aktiv (temporär) |
| Datenbank | Supabase (PostgreSQL) | Geplant |
| Hosting | Vercel | Geplant |
| KI-Gateway | OpenRouter API | Aktiv |
| KI-Modelle | Gemini 2.5 Flash, Claude Sonnet 4, Claude Opus 4.6 | Aktiv |

---

## 4. Projektstruktur

```
lern-tracker/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Einstiegspunkt / Dashboard
│   ├── layout.tsx          # Root Layout
│   ├── klausuren/          # Klausur-Datenbank (CRUD)
│   ├── themen/             # Themenübersicht
│   ├── wochenplan/         # Wochenplan
│   ├── kalender/           # Kalender
│   ├── onboarding/         # Onboarding-Flow (5 Schritte)
│   ├── plan/               # KI-Lernplan-Anpassung
│   └── admin/              # Admin-Bereich (Prompts + Gewichte)
├── components/             # Wiederverwendbare UI-Komponenten
│   ├── ui/                 # shadcn/ui Basiskomponenten
│   └── ...                 # Projektspezifische Komponenten
├── lib/                    # Hilfsfunktionen, API-Clients, Datenlogik
├── types/                  # TypeScript-Typdefinitionen
├── public/                 # Statische Assets
├── .env.local              # Lokale Umgebungsvariablen (nicht committen!)
└── README.md               # Diese Datei
```

---

## 5. Features (aktuell — Phase 2)

### Dashboard
- Grüne Fortschritts-Kacheln für alle ~110 Themen
- Hierarchischer Themenbaum (Rechtsgebiet → Teilgebiet → Einzelthema)
- Auf einen Blick: Gesamtfortschritt, Wochenziel, nächste Sprint-Empfehlung

### Fortschrittstracking
- Slider-Eingabe (0–100 %) pro Thema
- Notizfeld für qualitative Einschätzungen
- Lernhistorie je Thema mit Zeitstempel

### Wochenplan
- 90-Minuten-Sprints nach ultradian-rhythmischen Prinzipien
- Automatisches Interleaving: ZR → ÖffR → SR → Rotation
- Wochenziele und tägliche Sprint-Slots

### Themenübersicht
- Vollständige Liste aller ~110 Themen
- Suchfunktion und Filterung nach Rechtsgebiet / Fortschrittsgrad

### Kalender
- Integration von: AG-Terminen, Repetitoriumsterminen (z.B. Kaiser), Probeexamina, freien Tagen
- Visuelle Übersicht über die gesamte Lernphase bis 03.09.2026

### Onboarding-Flow
- 5 Schritte: Profil → Prüfungsdetails → Dokument-Upload → Ziele → KI-Plangeneration
- Hochladen von Lehrplänen / Skripten als Kontext für KI-Empfehlungen

### Abend-Check-in (KI-Chat)
- Gesprächsbasierter Check-in mit **Gemini 2.5 Flash**
- Tagesbilanz: Was lief gut? Was war schwierig? Was morgen?
- Ergebnisse fließen in Lernhistorie ein

### Lernplan-Anpassung (KI)
- Vollständiger Fortschrittskontext wird an **Claude Opus 4.6** übergeben
- Dynamische Anpassung des Wochenplans auf Basis von Lücken und Restzeit

### Klausur-Datenbank & tägliche Empfehlung
- **Klausur-Verwaltung** (`/klausuren`): CRUD für Klausuren mit Titel, Rechtsgebiet, Schwierigkeit, Sachverhalt, Lösungsskizze und Themen-Tags (direkt aus dem Topic-Tree)
- **Klausur des Tages**: Scoring-Algorithmus empfiehlt morgens die optimale Klausur basierend auf:
  - Themen-Overlap mit Tagesplan
  - Schwache Themen abdecken
  - Noch nie geschrieben / Spaced Repetition
  - Rechtsgebiets-Balance (3:2:2)
  - Neuheits-Bonus (neuere Klausuren bevorzugen)
- **Gewichtung konfigurierbar** in `/admin` (Slider + Zahleneingabe pro Faktor)

### Erweitertes Lern-Tracking
- **Tracking-FAB** auf dem Dashboard: Jede Lernaktivität eintragen (Theorie, Klausur, Wiederholung, Karteikarten, AG, Rep)
- Pro Eintrag: Themen, Dauer, Selbstbewertung (1-5 Sterne), Notizen
- Klausur-Einträge referenzieren die geschriebene Klausur direkt
- Vollständige Tracking-Daten fließen in die KI-Lernplan-Anpassung ein (Opus 4.6 sieht: Aktivitäts-Zusammenfassung, geschriebene Klausuren mit Ratings, nie bearbeitete Themen)

### Admin-Bereich
- Manuelles Editieren der Systemprompts für alle KI-Funktionen
- KI-assistiertes Prompt-Engineering (Prompt-Verbesserung per Klick)
- **Klausur-Empfehlung Gewichtung**: 9 konfigurierbare Scoring-Faktoren mit Slidern

### Weitere
- **Mobile-First Design**: optimiert für Smartphone-Nutzung unterwegs
- **localStorage-Persistenz**: alle Daten lokal im Browser, keine Anmeldung nötig (Phase 2)

---

## 6. Geplante Features

### Phase 3 — Supabase & Lerngruppe

- **Supabase-Integration**: Benutzerkonten, echte Datenbankpersistenz, Row-Level Security
- **Soziales Dashboard**: Geteilter Fortschrittsvergleich für 5-köpfige Lerngruppe
- Gemeinsame Kalenderevents und Gruppenplan-Koordination

### Phase 4 — Klausur-Tools

- **Klausurdatenbank-Import**: Vergangene Examensklausuren strukturiert importieren
- **KI-Klausurkorrektur**: Automatisiertes Feedback zu Aufbau, Argumentation, Stil
- **Tenor/Rubrum/Stil-Trainer**: Gezielte Übungen für formale Klausurbestandteile
- **Abwägungstrainer**: Strukturierte Pro/Contra-Übungen zu strittigen Rechtsfragen

### Phase 5 — Vertiefung

- **Fallbasiertes Spaced Repetition**: Fälle statt Karten, Wiederholungsintervalle 1–3–7–30 Tage
- **Ernährungs- & Wellbeing-Tracker**: Schlaf, Sport, Stimmung als Lernvariablen
- **OneNote-Integration** (lokal): Direkter Zugriff auf Mitschriften und Schemata

---

## 7. Didaktische Grundprinzipien

Der Stex Tracker ist nach evidenzbasierten Lernprinzipien gebaut:

### Ultradian Rhythmen (90-Minuten-Sprints)
Kognitive Höchstleistung ist nur in Phasen von ~90 Minuten möglich, gefolgt von kurzen Erholungsphasen. Der Wochenplan ist daher in 90-Min-Blöcke mit Pflichtpausen strukturiert.

### Active Recall
Kein passives Lesen. Jede Lerneinheit endet mit einer Selbstabfrage: "Kann ich das Schema aus dem Kopf aufschreiben?" Nur dann gilt ein Thema als bearbeitet.

### Spaced Repetition (Intervall-Wiederholung)
Wiederholungsintervalle: **1 → 3 → 7 → 30 Tage**. Themen, die länger nicht gesehen wurden, werden automatisch im Plan priorisiert.

### Interleaving
Themen werden nicht geblockt (erst alles ZR, dann alles ÖffR), sondern gemischt: ZR → ÖffR → SR → ZR → ... Das erzwingt aktives Abrufen und verbessert Transferleistung.

### Phasenmodell
Die ~21 Wochen sind in Phasen unterteilt (Aufbau → Output → Puffer → Tapering), mit klar definierten Zielen und unterschiedlicher Intensität.

---

## 8. Datenmodell

Aktuell localStorage-basiert; bei Supabase-Migration werden folgende Tabellen angelegt:

```sql
users              -- Profil, Einstellungen, Lernziele
topics             -- Hierarchische Themenstruktur (parent_id für Baum)
progress           -- Fortschrittsstand je Topic (0-100 %, Notizen)
learning_entries   -- Zeitgestempelte Lerneinträge (Verlaufshistorie)
calendar_events    -- AG, Rep, Probeexamen, freie Tage
schedule           -- Wochenplan-Slots (Tag, Uhrzeit, Topic, Sprint-Dauer)
klausuren          -- Klausur-Datenbank (Titel, Gebiet, Themen-Tags, Sachverhalt, Lösung)
tracking_entries   -- Erweitertes Tracking (Aktivitätstyp, Themen, Klausur-Ref, Dauer, Rating)
recommender_weights -- Scoring-Gewichte für Klausur-Empfehlung (konfigurierbar)
user_settings      -- KI-Systemprompts, UI-Präferenzen, Lerngruppen-ID
```

### Topics-Hierarchie (Beispiel)

```
Zivilrecht
├── Schuldrecht AT
│   ├── Vertragsschluss
│   ├── AGB
│   └── Leistungsstörungen
├── Schuldrecht BT
│   ├── Kaufrecht
│   └── Werkvertragsrecht
└── Sachenrecht
    ├── Eigentumserwerb bewegliche Sachen
    └── Grundstücksrecht
```

---

## 9. KI-Architektur (3-Tier)

Alle KI-Anfragen laufen über den **OpenRouter API**-Gateway und werden je nach Aufgabe einem von drei Tiers zugeteilt:

| Tier | Modell | Einsatz | Kosten |
|---|---|---|---|
| **Premium** | Claude Opus 4.6 | Lernplan-Anpassung, komplexe Analysen mit vollem Fortschrittskontext | Hoch |
| **Strong** | Claude Sonnet 4 | Klausurfeedback, Prompt-Verbesserung im Admin-Bereich | Mittel |
| **Cheap** | Gemini 2.5 Flash | Abend-Check-in Chat, einfache Zusammenfassungen | Niedrig |

### Systemprompt-Management
- Jede KI-Funktion hat einen eigenen, editierbaren Systemprompt
- Prompts werden in `user_settings` gespeichert (localStorage / später Supabase)
- Im Admin-Bereich: manuelles Editieren + KI-assistierte Verbesserung (per Klick)

---

## 10. Setup & Entwicklung

### Voraussetzungen
- Node.js >= 18
- npm oder pnpm
- OpenRouter API-Key (kostenlos unter [openrouter.ai](https://openrouter.ai))

### Lokale Installation

```bash
# Repository klonen
git clone https://github.com/BabbaHHH/lern-tracker.git
cd lern-tracker

# Abhängigkeiten installieren
npm install

# Umgebungsvariablen anlegen
cp .env.example .env.local
# .env.local öffnen und befüllen (siehe unten)

# Entwicklungsserver starten
npm run dev
```

Anwendung läuft dann auf [http://localhost:3000](http://localhost:3000).

### Umgebungsvariablen (`.env.local`)

```env
# OpenRouter API (erforderlich für alle KI-Features)
OPENROUTER_API_KEY=sk-or-...

# Supabase (nur für Phase 3, aktuell nicht benötigt)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

> **Wichtig**: `.env.local` niemals committen. Die Datei ist in `.gitignore` eingetragen.

### Nützliche Skripte

```bash
npm run dev        # Entwicklungsserver mit Hot-Reload
npm run build      # Produktions-Build
npm run start      # Produktionsserver lokal starten
npm run lint       # ESLint-Check
npm run type-check # TypeScript-Überprüfung
```

---

## 11. Deployment

### Vercel (geplant)

1. Repository mit Vercel verbinden (GitHub-Integration)
2. Umgebungsvariablen in Vercel-Dashboard eintragen
3. Automatisches Deployment bei jedem Push auf `main`

### Supabase (geplant — Phase 3)

1. Neues Supabase-Projekt anlegen
2. Migrations-Skripte aus `supabase/migrations/` ausführen
3. Row-Level Security Policies aktivieren
4. Supabase-Credentials in Vercel-Umgebungsvariablen eintragen

---

## 12. Entscheidungsprotokoll

Dieses Protokoll dokumentiert wichtige Architektur- und Designentscheidungen.

| Datum | Entscheidung | Begründung |
|---|---|---|
| 2026-04 | localStorage statt Supabase (Phase 2) | Schnellere Entwicklung; Supabase-Migration folgt in Phase 3 sobald Lerngruppe dazukommt |
| 2026-04 | OpenRouter statt direkter Anthropic/Google-API | Ein einziger API-Key für alle Modelle; einfaches Modell-Switching ohne Code-Änderungen |
| 2026-04 | 3-Tier KI-Architektur | Kostenoptimierung: teures Opus nur für komplexe Aufgaben; Flash für einfachen Chat |
| 2026-04 | Mobile-First Design | Tracker wird hauptsächlich unterwegs auf dem Smartphone benutzt |
| 2026-04 | 90-Min-Sprints als Planungseinheit | Ultradian-Rhythmus-Forschung; passt zu Klausurdauer (5h = ~3 Sprints + Pausen) |

---

*Letzte Aktualisierung: April 2026 — Dieses Dokument wächst mit dem Projekt mit.*
