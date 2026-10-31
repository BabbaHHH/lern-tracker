export function ProjectFooter({ accountMode = false }: { accountMode?: boolean }) {
  const bottomSpacing = accountMode ? "pb-4 md:pb-6" : "pb-20 md:pb-6";

  return (
    <footer className={`mt-auto border-t border-slate-200 px-4 pt-5 ${bottomSpacing}`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-1 font-sans sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <span className="font-serif text-sm text-slate-900">Stex Tracker</span>
        <p className="max-w-2xl text-xs leading-relaxed text-slate-500">
          Ein privates, kostenloses Lernprojekt von Niklas zur Vorbereitung auf das 2. juristische Staatsexamen.
        </p>
      </div>
    </footer>
  );
}
