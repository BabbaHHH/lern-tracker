import type { DailyTask } from "@/lib/store";
import { taskMinutes } from "@/lib/day-budget";
import {preparationKnownMinutes} from '@/lib/learning/preparation-duration';

export function PlanningBacklog({ tasks,account=false,reasons={} }: { tasks: DailyTask[];account?:boolean;reasons?:Record<string,string> }) {
  if (!tasks.length) return null;
  return (
    <details className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 my-3">
      <summary className="cursor-pointer font-semibold">Noch einzuplanen: {tasks.length} Aufgaben</summary>
      <p className="mt-2">{account?'Diese offenen oder zurückgestellten Aufgaben bleiben gespeichert. Prüfe die Tagesvorbereitung und bestätige passende Änderungen bewusst.':'Diese Aufgaben passen derzeit nicht vor das Examen bzw. in die nächsten 90 Tage. Sie bleiben gespeichert. Nach Änderungen an Terminen oder Tagesgrenze versucht die Planung es erneut.'}</p>
      <ul className="mt-2 space-y-1">
        {tasks.map(task => <li key={task.id}>{task.title} · {account?(preparationKnownMinutes(task)===null?'Dauer offen':`${preparationKnownMinutes(task)} min`):`${taskMinutes(task)} min`} · ursprünglich {task.rescheduledFrom ?? task.date}{account&&reasons[task.id]?` · ${reasons[task.id]}`:''}</li>)}
      </ul>
      <a className="underline inline-block mt-2" href="/onboarding">{account?'Profil und vorhandene Termine prüfen':'Zeitbudget und Termine anpassen'}</a>
    </details>
  );
}
