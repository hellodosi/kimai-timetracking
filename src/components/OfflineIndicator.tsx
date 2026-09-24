import React from 'react';
import { Wifi, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import type { ServerStatus } from '../types/kimai';

interface OfflineIndicatorProps {
  isOnline: boolean;
  serverStatus: ServerStatus;
  pendingSyncCount: number;
  isSyncing: boolean;
  onCheckConnection: () => void;
  onSyncPending: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline,
  serverStatus,
  pendingSyncCount,
  isSyncing,
  onCheckConnection,
  onSyncPending,
}) => {
  // If browser is completely offline or Kimai server is not reachable
  if (!isOnline || !serverStatus.isReachable) {
    return (
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span>
            <strong className="text-slate-200">Offline-Modus:</strong>{' '}
            {!isOnline
              ? 'Keine Internetverbindung.'
              : 'Server momentan nicht erreichbar.'}{' '}
            Zeiten werden lokal gespeichert und bei nächster Erreichbarkeit übertragen.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingSyncCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800/60 text-amber-300 font-medium text-[11px]">
              {pendingSyncCount} {pendingSyncCount === 1 ? 'Eintrag ausstehend' : 'Einträge ausstehend'}
            </span>
          )}
          {isOnline && (
            <button
              onClick={onCheckConnection}
              disabled={serverStatus.checking}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
              title="Verbindung zum Server prüfen"
            >
              <RefreshCw className={`w-3 h-3 ${serverStatus.checking ? 'animate-spin' : ''}`} />
              {serverStatus.checking ? 'Prüfe...' : 'Verbindung prüfen'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Connected to Kimai server and there are pending items waiting or syncing
  if (pendingSyncCount > 0 || isSyncing) {
    return (
      <div className="bg-sky-950/80 border-b border-sky-800/80 px-4 py-2 text-xs text-sky-200 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span>
            <strong className="text-emerald-400">Verbunden:</strong> Server erreichbar.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onSyncPending}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchronisiere...' : `Jetzt synchronisieren (${pendingSyncCount})`}
          </button>
        </div>
      </div>
    );
  }

  return null;
};
