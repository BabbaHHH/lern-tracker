"use client";

import { useState, useEffect, useCallback } from "react";
import { isBackupOverdue, exportAll, markBackupDone } from "@/lib/store";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackupReminder() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // localStorage-Hydration nach Mount, SSR-safe
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(isBackupOverdue(3));
  }, []);

  const handleBackup = useCallback(() => {
    const bundle = exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lerntracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShow(false);
  }, []);

  const handleDismiss = useCallback(() => {
    markBackupDone();
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
      <Download className="h-4 w-4 shrink-0 text-amber-600" />
      <span className="flex-1">Dein letztes Backup ist über 3 Tage her.</span>
      <Button variant="outline" size="sm" onClick={handleBackup} className="h-7 text-xs">
        Jetzt sichern
      </Button>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground" title="Später erinnern">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
