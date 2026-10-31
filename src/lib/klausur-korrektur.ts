// Orchestrierung der KI-Korrektur (3-Ebenen-Hierarchie).
// Reine Logik: baut die Messages, extrahiert den Fokus je Granularität,
// splittet die Antwort (Prosa + Marker-JSON) und mergt das Ergebnis ins Profil.
// Der eigentliche HTTP-Call läuft über useAi/callAi in der Page.

import type { AiMessage } from "@/lib/ai";
import {
  AREA_LABELS,
  type KlausurDraft,
  type KlausurFeedback,
  type FehlerMarker,
  type KorrekturGranularity,
} from "@/lib/types";
import {
  getPromptById,
  resolveKlausurtypPromptId,
  KORREKTUR_MASTER_PROMPT_ID,
} from "@/lib/prompts";
import { buildContextFor } from "@/lib/prompt-context";
import { parseAiJson } from "@/lib/ai-helpers";
import { mergeFehlerMarkers, saveKlausurDraft } from "@/lib/store";

/** Trenner zwischen Prosa-Feedback und Marker-JSON (im Master-Prompt definiert). */
export const MARKER_SENTINEL = "---MARKER-JSON---";

export type FeedbackScope = KlausurFeedback["scope"]; // wort|satz|absatz|abschnitt|gesamt

/** Ergebnis von extractFocus: der bewertete Span + begrenzter Kontext. */
export interface FocusResult {
  scope: FeedbackScope;
  /** Der tatsächlich zu bewertende Text. */
  focus: string;
  /** Kontext DAVOR (nur Orientierung, wird nicht bewertet). */
  before: string;
  /** Kontext DANACH (nur bei manueller Auswahl). */
  after: string;
  /** Hinweis an die KI, wie scharf/umfangreich die Kritik sein soll. */
  granularityHint: string;
}

// Zeichen-Budgets je Granularität (siehe Plan-Payload-Tabelle).
const BUDGET = {
  wort: { before: 400 },
  satz: { before: 800 },
  absatz: { before: 1200 },
  auswahl: { before: 800, after: 400 },
} as const;

function clampEnd(s: string, max: number): string {
  // letzte `max` Zeichen, an Wortgrenze sauber abgeschnitten
  if (s.length <= max) return s.trim();
  const cut = s.slice(s.length - max);
  const sp = cut.indexOf(" ");
  return (sp > 0 ? cut.slice(sp + 1) : cut).trim();
}

function clampStart(s: string, max: number): string {
  if (s.length <= max) return s.trim();
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut).trim();
}

function splitSentences(s: string): string[] {
  return (s.match(/[^.!?]+[.!?]+["»')\]]*\s*/g) ?? []).map((x) => x.trim()).filter(Boolean);
}

function splitParagraphs(s: string): string[] {
  return s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/**
 * Bestimmt aus dem Volltext (+ optionaler Caret-Position) den zu bewertenden Fokus
 * und sein begrenztes Kontextfenster. Vorwärts-Schreibfluss: bei Live-Triggern wird
 * nur Kontext DAVOR mitgeschickt, nie nachfolgender (unfertiger) Text.
 *
 * @param text   Plaintext der Klausur
 * @param caret  Cursor-Offset (Default = Textende)
 * @param granularity  manuell | wort | satz | absatz
 * @param selection  bei "manuell": der markierte Text (sonst leer)
 */
export function extractFocus(
  text: string,
  caret: number | null,
  granularity: KorrekturGranularity,
  selection?: string,
): FocusResult | null {
  const full = text ?? "";
  const pos = caret == null ? full.length : Math.max(0, Math.min(caret, full.length));

  // Manuelle Auswahl: markierter Text als Fokus, Fenster davor + danach.
  if (granularity === "manuell") {
    const sel = (selection ?? "").trim();
    if (!sel) return null;
    const at = full.indexOf(sel);
    const before = at > 0 ? clampEnd(full.slice(0, at), BUDGET.auswahl.before) : "";
    const after = at >= 0 ? clampStart(full.slice(at + sel.length), BUDGET.auswahl.after) : "";
    return {
      scope: "abschnitt",
      focus: sel,
      before,
      after,
      granularityHint: "Abschnitts-Korrektur des markierten Texts.",
    };
  }

  const head = full.slice(0, pos);

  if (granularity === "wort") {
    const words = head.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    const focus = words.slice(-3).join(" ");
    const ctx = head.slice(0, head.length - focus.length);
    const sentStart = Math.max(
      ctx.lastIndexOf(". "), ctx.lastIndexOf("! "), ctx.lastIndexOf("? "), ctx.lastIndexOf("\n"),
    );
    const before = clampEnd(ctx.slice(sentStart + 1), BUDGET.wort.before);
    return {
      scope: "wort",
      focus,
      before,
      after: "",
      granularityHint: "Nur Lexik / Terminologie / Tippfehler / verbotene Floskeln prüfen — knapp.",
    };
  }

  if (granularity === "satz") {
    const sentences = splitSentences(head);
    if (sentences.length === 0) return null;
    const focus = sentences[sentences.length - 1];
    const paraStart = head.lastIndexOf("\n\n");
    const paraBefore = head.slice(paraStart + 1, head.length - focus.length);
    const before = clampEnd(paraBefore, BUDGET.satz.before);
    return {
      scope: "satz",
      focus,
      before,
      after: "",
      granularityHint: "Satzbau, Stil und einzelne Formfehler dieses Satzes prüfen.",
    };
  }

  // granularity === "absatz"
  const paras = splitParagraphs(head);
  if (paras.length === 0) return null;
  const focus = paras[paras.length - 1];
  const before = paras.length > 1 ? clampEnd(paras[paras.length - 2], BUDGET.absatz.before) : "";
  return {
    scope: "absatz",
    focus,
    before,
    after: "",
    granularityHint: "Argumentations- / Subsumtionsaufbau und Kohärenz dieses Absatzes prüfen.",
  };
}

/** Fokus für ein Gesamt-Gutachten (ganze Klausur, kein Fenster nötig). */
export function gesamtFocus(text: string): FocusResult {
  return {
    scope: "gesamt",
    focus: (text ?? "").trim(),
    before: "",
    after: "",
    granularityHint: "Volle Korrektur inkl. Gesamtaufbau, Schwerpunktsetzung, Tenor/Ergebnis.",
  };
}

/**
 * Baut das Message-Array für einen Korrektur-Call.
 * System = Ebene 1 (Master) + Ebene 2 (Klausurtyp) + Rechtsgebiets-/Typ-Zeile.
 * User  = Ebene 3 (Fehlerprofil-Kontext) + optional Sachverhalt + Fokus + Fenster.
 */
export function buildKorrekturMessages(draft: KlausurDraft, focus: FocusResult): AiMessage[] {
  const master = getPromptById(KORREKTUR_MASTER_PROMPT_ID);
  const typ = getPromptById(resolveKlausurtypPromptId(draft.type));

  const areaLine = `Rechtsgebiet: ${draft.area ? AREA_LABELS[draft.area] : "(nicht angegeben)"}`;
  const typLine = `Klausurtyp: ${draft.type ?? "(nicht angegeben)"}`;
  const system = [master?.prompt, typ?.prompt, areaLine, typLine].filter(Boolean).join("\n\n");

  const context = buildContextFor(master?.contextFlags ?? ["fehlerprofil"]);

  const parts: string[] = [];
  if (context) parts.push(context);
  if (draft.sachverhalt?.trim()) parts.push(`SACHVERHALT (Ground Truth, nicht bewerten):\n${draft.sachverhalt.trim()}`);
  parts.push(`KORREKTUR-UMFANG: ${focus.scope} — ${focus.granularityHint}`);
  if (focus.before) parts.push(`KONTEXT DAVOR (nur Orientierung, nicht bewerten):\n${focus.before}`);
  parts.push(`ZU BEWERTENDER TEXT:\n${focus.focus}`);
  if (focus.after) parts.push(`KONTEXT DANACH (nur Orientierung, nicht bewerten):\n${focus.after}`);

  return [
    { role: "system", content: system },
    { role: "user", content: parts.join("\n\n") },
  ];
}

/** Splittet die KI-Antwort in Prosa-Feedback und erkannte Marker. */
export function splitKorrekturAntwort(reply: string): { prosa: string; markers: FehlerMarker[] } {
  const raw = reply ?? "";
  const idx = raw.indexOf(MARKER_SENTINEL);
  const prosa = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const jsonPart = idx >= 0 ? raw.slice(idx + MARKER_SENTINEL.length) : "";

  let markers: FehlerMarker[] = [];
  if (jsonPart.trim()) {
    const parsed = parseAiJson<{ markers?: FehlerMarker[] }>(jsonPart);
    if (Array.isArray(parsed.data?.markers)) markers = parsed.data.markers;
  }
  markers = markers.filter((m) => m && typeof m.key === "string" && /^[a-z0-9_]{1,100}$/i.test(m.key)
    && !["__proto__", "constructor", "prototype"].includes(m.key) && typeof m.label === "string").slice(0, 50);
  return { prosa, markers };
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Verarbeitet eine rohe KI-Antwort: splittet sie, mergt die Marker ins lernende
 * Fehlerprofil (Ebene 3), hängt das Feedback an den Entwurf an und speichert.
 * Gibt den aktualisierten Entwurf + das neue Feedback zurück.
 */
export function applyKorrekturResult(
  draft: KlausurDraft,
  focus: FocusResult,
  reply: string,
  model: string,
): { draft: KlausurDraft; feedback: KlausurFeedback } {
  const { prosa, markers } = splitKorrekturAntwort(reply);
  mergeFehlerMarkers(markers, draft.type);

  const feedback: KlausurFeedback = {
    id: newId(),
    scope: focus.scope,
    excerpt: focus.focus.slice(0, 280),
    feedbackText: prosa,
    markers,
    model,
    createdAt: new Date().toISOString(),
  };

  const saved = saveKlausurDraft({ ...draft, feedback: [feedback, ...draft.feedback] });
  return { draft: saved, feedback };
}
