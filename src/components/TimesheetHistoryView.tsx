import React, { useState } from 'react';
import { RefreshCw, Clock, CheckCircle2, AlertCircle, Trash2, Plus, Calendar, Tag, Folder, ArrowRight } from 'lucide-react';
import type { TimesheetEntry } from '../types/kimai';

interface TimesheetHistoryViewProps {
  entries: TimesheetEntry[];
  isSyncing: boolean;
  isKimaiConnected: boolean;
  onSyncAll: () => void;
  onDeleteEntry: (localId: string) => void;
  onOpenManualModal: () => void;
}

export const TimesheetHistoryView: React.FC<TimesheetHistoryViewProps> = ({
  entries,
  isSyncing,
  isKimaiConnected,
  onSyncAll,
  onDeleteEntry,
  onOpenManualModal,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'synced'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const pendingCount = entries.filter((e) => e.syncStatus === 'pending' || e.syncStatus === 'failed').length;

  const filteredEntries = entries.filter((entry) => {
    if (filter === 'pending' && entry.syncStatus !== 'pending' && entry.syncStatus !== 'failed') {
      return false;
    }
    if (filter === 'synced' && entry.syncStatus !== 'synced') {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchProject = entry.projectName.toLowerCase().includes(q);
      const matchActivity = entry.activityName.toLowerCase().includes(q);
      const matchDesc = (entry.description || '').toLowerCase().includes(q);
      const matchCustomer = (entry.customerName || '').toLowerCase().includes(q);
      return matchProject || matchActivity || matchDesc || matchCustomer;
    }
    return true;
  });

  const calculateDuration = (beginStr: string, endStr?: string | null) => {
    if (!endStr) return 'Läuft...';
    const start = new Date(beginStr).getTime();
    const end = new Date(endStr).getTime();
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTimeRange = (beginStr: string, endStr?: string | null) => {
    const start = new Date(beginStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!endStr) return `${start} - jetzt`;
    const end = new Date(endStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${start} - ${end}`;
  };

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              filter === 'all'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Alle ({entries.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
              filter === 'pending'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>Ausstehend</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-200 text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('synced')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              filter === 'synced'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Synchronisiert
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenManualModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition border border-slate-700"
          >
            <Plus className="w-4 h-4 text-sky-400" />
            <span>Manuell eintragen</span>
          </button>

          {pendingCount > 0 && isKimaiConnected && (
            <button
              onClick={onSyncAll}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium shadow transition active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronisiere...' : `Sync (${pendingCount})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      {entries.length > 0 && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Einträge filtern nach Projekt, Tätigkeit, Notiz..."
          className="w-full py-2 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
        />
      )}

      {/* Entry List */}
      {filteredEntries.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 text-slate-400 space-y-2">
          <Clock className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-300">Keine Zeiteinträge gefunden</h4>
          <p className="text-xs text-slate-500">
            {filter === 'pending'
              ? 'Alle Zeiten sind bereits erfolgreich mit Kimai synchronisiert.'
              : 'Starten Sie die Zeiterfassung oder erfassen Sie einen manuellen Eintrag.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredEntries.map((entry) => (
            <div
              key={entry.localId}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {/* Left Content */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white text-sm">
                    {entry.projectName}
                  </span>
                  {entry.customerName && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                      {entry.customerName}
                    </span>
                  )}
                  <span className="text-xs text-sky-400 font-medium">
                    • {entry.activityName}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {formatDate(entry.begin)}
                  </span>
                  <span className="font-mono text-slate-300">
                    {formatTimeRange(entry.begin, entry.end)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-mono text-[11px] font-semibold">
                    {calculateDuration(entry.begin, entry.end)}
                  </span>
                </div>

                {entry.description && (
                  <p className="text-xs text-slate-300 italic pt-0.5">
                    "{entry.description}"
                  </p>
                )}

                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {entry.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {entry.syncError && (
                  <div className="text-[11px] text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>Sync-Fehler: {entry.syncError}</span>
                  </div>
                )}
              </div>

              {/* Right Content / Badges & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                {entry.syncStatus === 'synced' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Synchronisiert {entry.remoteId ? `#${entry.remoteId}` : ''}
                  </span>
                ) : entry.syncStatus === 'syncing' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Wird übertragen...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Offline (Ausstehend)
                  </span>
                )}

                <button
                  onClick={() => {
                    if (confirm('Diesen Eintrag wirklich aus dem lokalen Speicher entfernen?')) {
                      onDeleteEntry(entry.localId);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                  title="Eintrag löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
