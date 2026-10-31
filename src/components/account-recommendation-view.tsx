"use client";
import {useState} from 'react';
import Link from 'next/link';
import {Scale,Zap,ChevronRight,Star,Check,Clock,ChevronDown,Plus,Eye} from 'lucide-react';
import {AREA_LABELS,type Area} from '@/lib/types';
import {TOPICS} from '@/lib/topics';
import {cn} from '@/lib/utils';
import {PromptGear} from './prompt-gear';
import {Badge} from './ui/badge';
import {Button} from './ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from './ui/dialog';
import {Textarea} from './ui/textarea';
import type {AccountRecommendation,AccountCase} from './account-recommendation-model';
const AREA_GRADIENT:Record<Area,string>={zr:'from-accent-500 to-blue-600',oeffr:'from-amber-500 to-orange-600',sr:'from-rose-500 to-pink-600'};
export function AccountRecommendationView({recommendation,hasKlausuren,disabled,taskError,add,done,processed}:{recommendation:AccountRecommendation|null;hasKlausuren:boolean;disabled:boolean;taskError:string;add:(k:AccountCase,mode:'written'|'read')=>Promise<boolean>;done:(k:AccountCase,mode:'written'|'read',rating:number,note:string)=>Promise<boolean>;processed:Map<string,{date:string;mode:'written'|'read'}>}){
 const [detailOpen,setDetailOpen]=useState(false),[doneDialogOpen,setDoneDialogOpen]=useState(false),[altsOpen,setAltsOpen]=useState(false),[rating,setRating]=useState(3),[note,setNote]=useState(''),[klausurMode,setKlausurMode]=useState<'written'|'read'>('written'),[saved,setSaved]=useState(false),[addedToTasks,setAddedToTasks]=useState<string|null>(null);
 const getTopicLabel=(id:string)=>TOPICS.find(t=>t.id===id)?.label??id;
 const bearbeitetBadge=(id:string)=>{const e=processed.get(id);return e?<span className="rounded bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 text-[9px]">{e.mode==='read'?'👁':'✍'} {e.date}</span>:null;};
 const addKlausurToToday=async(k:AccountCase,mode:'schreiben'|'skizze')=>{if(await add(k,mode==='skizze'?'read':'written'))setAddedToTasks(k.id);};
 const handleDone=async()=>{if(recommendation&&await done(recommendation.klausur,klausurMode,rating,note))setSaved(true);};
  // Keine Klausuren -> Link zur Datenbank
  if (!hasKlausuren) {
    return (
      <Link href="/klausuren">
        <div className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] p-4 flex items-center gap-3 transition-all cursor-pointer">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200/60 text-slate-700 group-hover:from-accent-50 group-hover:to-accent-100/60 group-hover:text-accent-700 group-hover:ring-accent-200/60 transition-all">
            <Scale className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 tracking-tight">Klausur-Datenbank</div>
            <div className="text-[11px] text-slate-500">Klausuren eintragen & täglich die passende üben</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    );
  }

  if (!recommendation) return null;

  const k = recommendation.klausur;

  const justAddedMain = addedToTasks === k.id || recommendation.assigned;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white ring-1 ring-white/5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.45)]">
        <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
          <PromptGear promptId="klausur-select" compact />
        </div>
        <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 bg-accent-400/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {taskError && <p role="alert" className="mx-5 my-3 text-sm text-amber-700 bg-amber-50 p-3">{taskError}</p>}
      {/* Haupt-Empfehlung */}
        <div
          onClick={() => setDetailOpen(true)}
          className="group relative p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className={cn(
              "p-1.5 rounded-lg bg-gradient-to-br shadow-md ring-1 ring-white/10",
              AREA_GRADIENT[k.area]
            )}>
              <Scale className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-accent-400 uppercase tracking-[0.16em]">Klausur des Tages</span>
                <Zap className="h-3 w-3 text-amber-400" />
              </div>
            </div>
            {bearbeitetBadge(k.id)}
            <Badge className="bg-white/10 text-white/80 text-[10px] border-0 backdrop-blur-sm">
              {AREA_LABELS[k.area]}
            </Badge>
          </div>

          <h3 className="font-bold text-[15px] mb-2 line-clamp-1 tracking-tight">{k.title}</h3>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/60 mb-3">
            {recommendation.reasons.slice(0, 2).map((r, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-accent-400" />
                {r}
              </span>
            ))}
          </div>

          {/* Action-Row: Schreiben + PDF + Skizzen */}
          <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              disabled={disabled} onClick={() => addKlausurToToday(k, "schreiben")}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
                justAddedMain
                  ? "bg-accent-500/20 text-accent-300 ring-1 ring-accent-400/30"
                  : "bg-white/10 hover:bg-white/15 text-white ring-1 ring-white/10"
              )}
            >
              {justAddedMain ? (
                <><Check className="h-3 w-3" /> Im Tagesplan</>
              ) : (
                <><Plus className="h-3 w-3" /> In den Tagesplan (5h)</>
              )}
            </button>
            {k.viewerURL && <Link href={k.viewerURL} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-white/70 ring-1 ring-white/10 transition-all"><Eye className="h-3 w-3" /> PDF</Link>}
            
            {recommendation.alternatives.length > 0 && (
              <button
                onClick={() => setAltsOpen(v => !v)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-white/70 ring-1 ring-white/10 transition-all"
              >
                {recommendation.alternatives.length} Skizzen
                <ChevronDown className={cn("h-3 w-3 transition-transform", altsOpen && "rotate-180")} />
              </button>
            )}
          </div>
        </div>

        {/* Skizzen-Empfehlungen */}
        {altsOpen && recommendation.alternatives.length > 0 && (
          <div className="border-t border-white/5 bg-slate-950/60 px-3 py-2 space-y-1">
            <div className="px-2 pt-1 text-[9px] font-semibold text-white/40 uppercase tracking-[0.16em]">
              Alternativen — skizzieren (2h, Lösungsskizze + Lösung lesen) oder schreiben (5h)
            </div>
            {recommendation.alternatives.map((alt) => {
              const justAdded = addedToTasks === alt.klausur.id;
              return (
                <div
                  key={alt.klausur.id}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <div className={cn(
                    "p-1 rounded-md bg-gradient-to-br shadow ring-1 ring-white/10 shrink-0",
                    AREA_GRADIENT[alt.klausur.area]
                  )}>
                    <Scale className="h-2.5 w-2.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[12px] font-medium text-white/90 truncate">{alt.klausur.title}</span>
                      {bearbeitetBadge(alt.klausur.id)}
                    </div>
                    <div className="text-[10px] text-white/50 truncate">{alt.reason}</div>
                  </div>
                  {alt.klausur.viewerURL && <Link href={alt.klausur.viewerURL} className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-white/60 ring-1 ring-white/10 transition-all" aria-label="PDF öffnen"><Eye className="h-3 w-3" /></Link>}
                  
                  <button
                    disabled={disabled} onClick={() => addKlausurToToday(alt.klausur, "skizze")}
                    title="Zum Skizzieren in den Tagesplan (2h)"
                    className={cn(
                      "shrink-0 inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md text-[10px] font-medium transition-all",
                      justAdded
                        ? "bg-accent-500/20 text-accent-300 ring-1 ring-accent-400/30"
                        : "bg-white/10 hover:bg-white/15 text-white/80 ring-1 ring-white/10"
                    )}
                    aria-label="Zum Skizzieren in den Tagesplan"
                  >
                    {justAdded ? <Check className="h-3 w-3" /> : <><Plus className="h-3 w-3" /> Skizze</>}
                  </button>
                  <button
                    disabled={disabled} onClick={() => addKlausurToToday(alt.klausur, "schreiben")}
                    title="Zum Schreiben in den Tagesplan (5h Realbedingungen)"
                    className={cn(
                      "shrink-0 inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md text-[10px] font-medium transition-all",
                      justAdded
                        ? "bg-accent-500/20 text-accent-300 ring-1 ring-accent-400/30"
                        : "bg-white/10 hover:bg-white/15 text-white/80 ring-1 ring-white/10"
                    )}
                    aria-label="Zum Schreiben in den Tagesplan"
                  >
                    {justAdded ? <Check className="h-3 w-3" /> : <><Plus className="h-3 w-3" /> 5h</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg mx-auto max-h-[80vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <div className={cn(
                "w-6 h-6 rounded-lg bg-gradient-to-br flex items-center justify-center",
                AREA_GRADIENT[k.area]
              )}>
                <Scale className="h-3.5 w-3.5 text-white" />
              </div>
              {k.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Meta */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-blue-100 text-blue-700 text-[10px]">{AREA_LABELS[k.area]}</Badge>
              {k.type && <Badge className="bg-slate-100 text-slate-600 text-[10px]">{k.type}</Badge>}
              {k.date && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {k.date}
                </span>
              )}
              {k.source && <Badge variant="outline" className="text-[10px]">{k.source}</Badge>}
            </div>

            {/* Warum diese Klausur */}
            <div className="bg-accent-50 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-accent-700 mb-1.5 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Warum heute?
              </div>
              <ul className="space-y-1">
                {recommendation.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-accent-600 flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-accent-400 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Themen */}
            {k.topicIds.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Abgedeckte Themen</div>
                <div className="flex flex-wrap gap-1">
                  {k.topicIds.map(tid => (
                    <Badge key={tid} variant="outline" className="text-[10px] bg-white">
                      {getTopicLabel(tid)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Hinweis auf Original-PDF */}
            {k.source && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
                Sachverhalt und Lösung: siehe Original-PDF <span className="font-medium text-slate-700">{k.source}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                disabled={disabled} onClick={() => { setDetailOpen(false); setDoneDialogOpen(true); }}
                className="flex-1 bg-gradient-to-r from-slate-900 to-accent-600 rounded-xl"
              >
                <Check className="h-4 w-4 mr-1" />
                Geschrieben — Eintragen
              </Button>
              {k.viewerURL && <Link href={k.viewerURL} className="rounded-xl"><Eye className="h-4 w-4 mr-1" /> PDF</Link>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Done Dialog (Tracking) */}
      <Dialog open={doneDialogOpen} onOpenChange={setDoneDialogOpen}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Klausur eintragen</DialogTitle>
          </DialogHeader>

          {saved ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6 text-accent-600" />
              </div>
              <p className="font-semibold text-slate-800">Eingetragen!</p>
              <p className="text-xs text-slate-500 mt-1">Fortschritt wird getrackt</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {taskError && <p role="alert" className="text-sm text-amber-800">{taskError}</p>}
              {/* Modus-Toggle */}
              <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
                {([
                  { v: "written", label: "✍ Geschrieben", sub: "100% Boost" },
                  { v: "read",    label: "👁 Gelesen / Skizziert", sub: "50% Boost" },
                ] as const).map(({ v, label, sub }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setKlausurMode(v)}
                    className={cn(
                      "flex-1 py-2.5 px-3 text-left transition-all",
                      klausurMode === v
                        ? v === "written" ? "bg-emerald-600 text-white" : "bg-sky-500 text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <div className="font-semibold text-[11px]">{label}</div>
                    <div className={cn("text-[9px] mt-0.5", klausurMode === v ? "text-white/70" : "text-slate-400")}>{sub}</div>
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">
                  Wie lief es? ({rating}/5)
                </label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        n <= rating
                          ? "bg-amber-100 text-amber-600"
                          : "bg-slate-100 text-slate-300"
                      )}
                    >
                      <Star className="h-5 w-5" fill={n <= rating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notizen (optional)</label>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Was lief gut? Was muss ich wiederholen?"
                  rows={3}
                  className="resize-none rounded-xl text-sm"
                />
              </div>

              <Button disabled={disabled} onClick={handleDone} className="w-full bg-gradient-to-r from-slate-900 to-accent-600 rounded-xl">
                Eintragen
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
