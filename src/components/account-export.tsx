'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ExportPhase = 'idle' | 'downloading' | 'complete' | 'error';

function exportErrorMessage(status: number, code?: string): string {
  if (status === 401 || code === 'unauthenticated') return 'Bitte erneut anmelden, um deine Kontodaten herunterzuladen.';
  if (status === 403 || code === 'pending' || code === 'forbidden') return 'Der Kontodownload ist für dieses Konto derzeit nicht freigegeben.';
  return 'Der Kontodownload ist gerade nicht verfügbar. Bitte später erneut versuchen.';
}

export function AccountExport({ expectedAccountKey, disabled = false }: { expectedAccountKey: string | null; disabled?: boolean }) {
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function download() {
    if (!expectedAccountKey || disabled || phase === 'downloading') return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setPhase('downloading');
    setMessage('Der persönliche Export wird vorbereitet …');

    try {
      const response = await fetch('/api/account/export', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { code?: string } } | null;
        if (controller.signal.aborted) return;
        setPhase('error');
        setMessage(exportErrorMessage(response.status, body?.error?.code));
        return;
      }

      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stex-personal-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPhase('complete');
      setMessage('Der Download wurde gestartet.');
    } catch {
      if (controller.signal.aborted) return;
      setPhase('error');
      setMessage('Der Kontodownload ist gerade nicht verfügbar. Bitte später erneut versuchen.');
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  const unavailable = disabled || !expectedAccountKey || phase === 'downloading';
  return <div className="space-y-2">
    <Button type="button" size="sm" variant="outline" disabled={unavailable} onClick={() => void download()}>
      <Download className="h-3 w-3 mr-1" />
      {phase === 'downloading' ? 'Export wird vorbereitet …' : 'Persönliche Kontodaten herunterladen'}
    </Button>
    {message && <p className="text-xs text-gray-600" role={phase === 'error' ? 'alert' : 'status'}>{message}</p>}
  </div>;
}
