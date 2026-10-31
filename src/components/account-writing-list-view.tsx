"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getKlausurDrafts, saveKlausurDraft, removeKlausurDraft, getKlausuren,
} from "@/lib/store";
import {
  AREA_LABELS, type Area, type KlausurType, type KlausurDraft, type Klausur,
} from "@/lib/types";
import { Plus, ArrowLeft, PenLine, Trash2, FileText, NotebookPen } from "lucide-react";

import type { ReactNode } from "react";
import type { WritingSummary, DraftFields } from "@/lib/learning/writing-contract";

const KLAUSUR_TYPES_BY_AREA: Record<Area, KlausurType[]> = {
  zr: ["Urteil", "Beschluss", "Anwaltsklausur", "Kautelarklausur"],
  oeffr: ["Urteil", "Beschluss", "Anwaltsklausur", "Behördenklausur", "Aktenvortrag"],
  sr: ["Anklageklausur", "Revisionsklausur", "Plädoyer", "Haftklausur", "Einspruch Strafbefehl", "Abschlussverfügung"],
};

const AREA_BADGE: Record<Area, string> = {
  zr: "bg-blue-100 text-blue-700",
  oeffr: "bg-amber-100 text-amber-700",
  sr: "bg-rose-100 text-rose-700",
};

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export interface OriginalWritingListAdapter {
 drafts: WritingSummary[]; klausuren: Pick<Klausur,"id"|"title"|"area"|"type">[]; status: ReactNode; disabled: boolean;
 create: (fields:DraftFields)=>Promise<boolean>; remove:(draft:WritingSummary)=>Promise<void>;
}
export function OriginalWritingList({remote}:{remote?:OriginalWritingListAdapter}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<KlausurDraft[]>([]);
  const [klausuren, setKlausuren] = useState<Klausur[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Formular
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<Area>("zr");
  const [type, setType] = useState<KlausurType>("Urteil");
  const [klausurId, setKlausurId] = useState<string>("");

  useEffect(() => {
    if (remote) return;
    // Hydrate browser-owned drafts after the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrafts(getKlausurDrafts());
    setKlausuren(getKlausuren());
  }, [remote]);

  const availableTypes = KLAUSUR_TYPES_BY_AREA[area];

  function changeArea(next: Area) {
    setArea(next);
    setKlausurId("");
    if (!KLAUSUR_TYPES_BY_AREA[next].includes(type)) setType(KLAUSUR_TYPES_BY_AREA[next][0]);
  }

  const linkableKlausuren = useMemo(
    () => (remote?.klausuren ?? klausuren).filter((k) => k.area === area),
    [remote?.klausuren, klausuren, area],
  );

  function handlePickKlausur(id: string) {
    setKlausurId(id);
    const k = (remote?.klausuren ?? klausuren).find((x) => x.id === id);
    if (k) {
      setTitle((t) => t || k.title);
      if (k.type && availableTypes.includes(k.type)) setType(k.type);
    }
  }

  function handleCreate() {
    const draft: KlausurDraft = {
      id: "",
      title: title.trim() || "Unbenannte Klausur",
      area,
      type,
      klausurId: klausurId || undefined,
      sachverhalt: "",
      contentHtml: "",
      contentText: "",
      feedback: [],
      createdAt: "",
      updatedAt: "",
    };
    if (remote) { void remote.create({title:draft.title,area,type,klausurId:klausurId||undefined,sachverhalt:"",contentHtml:"",contentText:""}).then(created=>{if(created)setDialogOpen(false);}); return; }
    try {
      const saved = saveKlausurDraft(draft);
      router.push(`/schreiben/${saved.id}`);
    } catch (error) { alert((error as Error).message); }
  }

  function handleDelete(id: string) {
    if (!confirm("Diesen Entwurf wirklich löschen?")) return;
    if (remote) { const d=remote.drafts.find(d=>d.id===id); if(d)void remote.remove(d); return; }
    removeKlausurDraft(id);
    setDrafts(getKlausurDrafts());
  }

  return (
    <>
      {!remote && <NavBar />}
      <main className={`flex-1 pb-24 pt-4 ${remote ? "md:pt-6" : "md:pt-20"} px-4 max-w-3xl mx-auto w-full`}>
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9 border border-slate-200 text-slate-600">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-serif text-2xl text-slate-900">Klausur schreiben</h1>
            <p className="text-[12px] text-slate-400">
              {remote ? "Private Entwürfe mit bestätigtem Autosave. Die KI-Korrektur bleibt im Pilot geschlossen." : "Schreibtraining mit strenger KI-Zweitkorrektur. Kein Ersatz fürs Examen — ein Werkzeug zum Einschleifen."}
            </p>
          </div>
          <Link href="/schreiben/notizblock">
            <Button variant="outline">
              <NotebookPen className="h-4 w-4" /> Notizblock
            </Button>
          </Link>
          <Button disabled={remote?.disabled} onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Neue Klausur
          </Button>
        </div>

        {remote?.status}
        {/* Liste */}
        {(remote?.drafts ?? drafts).length === 0 ? (
          <div className="border border-dashed border-slate-200 bg-white px-4 py-16 text-center text-slate-400">
            Noch keine Entwürfe. Leg mit „Neue Klausur“ los.
          </div>
        ) : (
          <div className="space-y-2">
            {(remote?.drafts ?? drafts).map((d) => (
              <div key={d.id} className="flex items-center gap-3 border border-slate-200 bg-white px-4 py-3">
                <FileText className="h-4 w-4 shrink-0 text-slate-300" />
                <Link href={`/schreiben/${d.id}`} className="min-w-0 flex-1 group">
                  <div className="truncate font-serif text-[15px] text-slate-900 group-hover:text-accent-600">{d.title}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    {d.area && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${AREA_BADGE[d.area]}`}>{AREA_LABELS[d.area]}</span>}
                    {d.type && <span>{d.type}</span>}
                    <span>· {("words" in d ? d.words : wordCount(d.contentText))} Wörter</span>
                    {("feedbackCount" in d ? d.feedbackCount : d.feedback.length) > 0 && <span>· {("feedbackCount" in d ? d.feedbackCount : d.feedback.length)}× Feedback</span>}
                  </div>
                </Link>
                <Link href={`/schreiben/${d.id}`}>
                  <Button variant="outline" size="sm"><PenLine className="h-3.5 w-3.5" /> Öffnen</Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-rose-600" disabled={remote?.disabled} aria-label={`Entwurf ${d.title} löschen`} onClick={() => handleDelete(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Neue-Klausur-Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Neue Klausur schreiben</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Titel</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Übungsklausur Kaufrecht" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Rechtsgebiet</label>
                <select
                  value={area}
                  onChange={(e) => changeArea(e.target.value as Area)}
                  className="h-9 w-full border border-slate-200 bg-white px-2 text-sm"
                >
                  {(["zr", "oeffr", "sr"] as Area[]).map((a) => (
                    <option key={a} value={a}>{AREA_LABELS[a]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Klausurtyp</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as KlausurType)}
                  className="h-9 w-full border border-slate-200 bg-white px-2 text-sm"
                >
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {linkableKlausuren.length > 0 && (
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Mit Klausur-DB verknüpfen (optional)
                </label>
                <select
                  value={klausurId}
                  onChange={(e) => handlePickKlausur(e.target.value)}
                  className="h-9 w-full border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">— keine —</option>
                  {linkableKlausuren.map((k) => (
                    <option key={k.id} value={k.id}>{k.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button disabled={remote?.disabled} onClick={handleCreate}><PenLine className="h-4 w-4" /> Schreiben</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
