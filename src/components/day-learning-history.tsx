import Link from "next/link";
import { ACTIVITY_LABELS, type Klausur, type TrackingEntry } from "@/lib/types";
import { RECALL_LABELS } from "@/lib/spaced-repetition";

export function DayLearningHistory({ entries, klausuren,accountMode=false }: { entries: TrackingEntry[]; klausuren: (Klausur&{viewerURL?:string})[];accountMode?:boolean }) {
  if (!entries.length) return null;
  return <div className="mt-3 border-t border-emerald-200 pt-2"><h3 className="text-xs font-medium text-emerald-800">Tatsächlich bearbeitet</h3><ul className="space-y-1 mt-1">{entries.map(entry => {
    const exam = klausuren.find(exam => exam.id === entry.klausurId);
    const title = entry.klausurId ? `${entry.klausurMode === "read" ? "Gelesen/skizziert" : "Geschrieben"}: ${exam?.title ?? entry.klausurId}` : `${ACTIVITY_LABELS[entry.activityType]}${entry.note.startsWith("[Task] ") ? `: ${entry.note.slice(7)}` : ""}`;
    return <li key={entry.id} className="text-xs text-slate-700">{entry.klausurId ? <Link href={accountMode?exam?.viewerURL??"/konto/klausuren":`/klausuren?case=${encodeURIComponent(entry.klausurId)}`} className="underline">{title}</Link> : title}<span className="block text-[10px] text-slate-500">{entry.durationMinutes} Min.{entry.rating && ` · Bewertung ${entry.rating}/5`}{entry.recallRating && ` · Abruf: ${RECALL_LABELS[entry.recallRating]}`}</span></li>;
  })}</ul></div>;
}
