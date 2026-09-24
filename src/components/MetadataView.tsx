import React, { useState } from 'react';
import { Folder, Building2, CheckSquare, RefreshCw, Search, ShieldCheck, Database, Calendar } from 'lucide-react';
import type { Customer, Project, Activity } from '../types/kimai';

interface MetadataViewProps {
  customers: Customer[];
  projects: Project[];
  activities: Activity[];
  lastSyncedAt: number | null;
  isSyncing: boolean;
  isKimaiConnected: boolean;
  onRefreshMetadata: () => void;
}

export const MetadataView: React.FC<MetadataViewProps> = ({
  customers,
  projects,
  activities,
  lastSyncedAt,
  isSyncing,
  isKimaiConnected,
  onRefreshMetadata,
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'customers' | 'activities'>('projects');
  const [searchQuery, setSearchQuery] = useState('');

  const getCustomerName = (custRef: number | Customer) => {
    if (typeof custRef === 'object' && custRef?.name) return custRef.name;
    const found = customers.find((c) => c.id === custRef);
    return found ? found.name : 'Allgemein';
  };

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    const custName = getCustomerName(p.customer).toLowerCase();
    return p.name.toLowerCase().includes(q) || custName.includes(q);
  });

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredActivities = activities.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Top Banner & Stats */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-white text-sm">Offline-Stammdaten</h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              AES-256 verschlüsselt
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {lastSyncedAt ? (
              <>Zuletzt aktualisiert: {new Date(lastSyncedAt).toLocaleString('de-DE')}</>
            ) : (
              <>Noch keine Online-Synchronisation durchgeführt (Offline-Cache aktiv).</>
            )}
          </p>
        </div>

        <button
          onClick={onRefreshMetadata}
          disabled={isSyncing || !isKimaiConnected}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold shadow transition active:scale-95 cursor-pointer"
          title={!isKimaiConnected ? 'Nur im Firmennetz verfügbar' : 'Stammdaten jetzt von Kimai neu laden'}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Lade Daten...' : 'Stammdaten aktualisieren'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 p-1 rounded-xl text-xs gap-1">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex-1 py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
            activeTab === 'projects'
              ? 'bg-sky-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          Projekte ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex-1 py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
            activeTab === 'customers'
              ? 'bg-sky-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Kunden ({customers.length})
        </button>
        <button
          onClick={() => setActiveTab('activities')}
          className={`flex-1 py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
            activeTab === 'activities'
              ? 'bg-sky-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          Aufgaben ({activities.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`In ${
            activeTab === 'projects'
              ? 'Projekten'
              : activeTab === 'customers'
              ? 'Kunden'
              : 'Aufgaben'
          } suchen...`}
          className="w-full py-2.5 pl-10 pr-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* Content Lists */}
      <div className="space-y-2">
        {activeTab === 'projects' && (
          <>
            {filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                Keine Projekte gefunden.
              </div>
            ) : (
              filteredProjects.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p.color || '#38bdf8' }}
                    />
                    <div>
                      <span className="font-semibold text-white block">{p.name}</span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        {getCustomerName(p.customer)}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">ID #{p.id}</span>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'customers' && (
          <>
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                Keine Kunden gefunden.
              </div>
            ) : (
              filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color || '#10b981' }}
                    />
                    <span className="font-semibold text-white">{c.name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">ID #{c.id}</span>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'activities' && (
          <>
            {filteredActivities.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                Keine Aufgaben gefunden.
              </div>
            ) : (
              filteredActivities.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: a.color || '#f59e0b' }}
                    />
                    <div>
                      <span className="font-semibold text-white block">{a.name}</span>
                      <span className="text-[11px] text-slate-400">
                        {a.project ? `Projekt-spezifisch (#${a.project})` : 'Global verfügbar'}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">ID #{a.id}</span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};
