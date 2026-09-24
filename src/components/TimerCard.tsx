import React, { useState, useEffect } from 'react';
import { Play, Square, Clock, Folder, CheckSquare, Tag, AlignLeft, Sparkles, Building2 } from 'lucide-react';
import type { ActiveTimer, Customer, Project, Activity } from '../types/kimai';

interface TimerCardProps {
  activeTimer: ActiveTimer | null;
  projects: Project[];
  customers: Customer[];
  activities: Activity[];
  isOnline: boolean;
  isKimaiConnected: boolean;
  onStartTimer: (params: {
    projectId: number;
    activityId: number;
    description: string;
    tags: string[];
    billable: boolean;
  }) => void;
  onStopTimer: () => void;
}

export const TimerCard: React.FC<TimerCardProps> = ({
  activeTimer,
  projects,
  customers,
  activities,
  isOnline,
  isKimaiConnected,
  onStartTimer,
  onStopTimer,
}) => {
  // Form state for starting new timer
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedActivityId, setSelectedActivityId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [billable, setBillable] = useState(true);

  // Filter activities by project if project defines activities
  const filteredActivities = activities.filter((act) => {
    if (!act.project) return true; // global activity
    return act.project === Number(selectedProjectId);
  });

  // Automatically select first project/activity if none selected and lists available
  useEffect(() => {
    if (selectedProjectId === '' && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedActivityId === '' && filteredActivities.length > 0) {
      setSelectedActivityId(filteredActivities[0].id);
    }
  }, [filteredActivities, selectedActivityId]);

  // Live timer elapsed calculations
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!activeTimer) {
      setElapsedSeconds(0);
      return;
    }

    const calcElapsed = () => {
      const startMs = new Date(activeTimer.begin).getTime();
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSec);
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleStart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProjectId || !selectedActivityId) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onStartTimer({
      projectId: Number(selectedProjectId),
      activityId: Number(selectedActivityId),
      description,
      tags,
      billable,
    });

    setDescription('');
    setTagsInput('');
  };

  // Find customer name for selected project
  const getCustomerNameForProject = (projId: number | ''): string => {
    if (!projId) return '';
    const proj = projects.find((p) => p.id === Number(projId));
    if (!proj) return '';
    if (typeof proj.customer === 'object' && proj.customer?.name) {
      return proj.customer.name;
    }
    const cust = customers.find((c) => c.id === proj.customer);
    return cust ? cust.name : '';
  };

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden transition-all duration-300">
      {/* Running Timer Display */}
      {activeTimer ? (
        <div className="p-6 sm:p-8 bg-gradient-to-b from-sky-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Zeiterfassung läuft
            </span>

            <span className="text-xs text-slate-400 font-mono">
              Gestartet: {new Date(activeTimer.begin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Large Live Stopwatch Display */}
          <div className="text-center my-6">
            <div className="text-5xl sm:text-6xl font-mono font-bold tracking-tight text-white drop-shadow-md">
              {formatTime(elapsedSeconds)}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Laufende Arbeitszeit
            </p>
          </div>

          {/* Active Details Card */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 mb-6">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-sky-400" />
                Projekt:
              </span>
              <span className="font-semibold text-white">
                {activeTimer.projectName}
                {activeTimer.customerName && (
                  <span className="text-slate-400 font-normal ml-1">({activeTimer.customerName})</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                Tätigkeit:
              </span>
              <span className="font-semibold text-sky-300">{activeTimer.activityName}</span>
            </div>

            {activeTimer.description && (
              <div className="pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-slate-400 block mb-0.5">Beschreibung:</span>
                <p className="text-slate-200 italic">{activeTimer.description}</p>
              </div>
            )}
          </div>

          {/* Big Stop Button */}
          <button
            onClick={onStopTimer}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-base shadow-lg shadow-rose-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
          >
            <Square className="w-5 h-5 fill-current" />
            Zeiterfassung stoppen
          </button>
        </div>
      ) : (
        /* Start New Timer Form */
        <form onSubmit={handleStart} className="p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-400" />
              Neue Zeiterfassung starten
            </h2>
            <span className="text-[11px] text-slate-400">
              Offline verfügbar
            </span>
          </div>

          {/* Project Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-sky-400" />
                Projekt auswählen
              </span>
              {selectedProjectId && (
                <span className="text-[11px] text-sky-400/80 font-normal">
                  {getCustomerNameForProject(selectedProjectId)}
                </span>
              )}
            </label>
            {projects.length > 0 ? (
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(Number(e.target.value));
                  setSelectedActivityId('');
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              >
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} {getCustomerNameForProject(proj.id) ? `(${getCustomerNameForProject(proj.id)})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                Keine Projekte im Offline-Speicher. Bitte synchronisieren Sie die Stammdaten.
              </div>
            )}
          </div>

          {/* Activity Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
              Aufgabe / Tätigkeit
            </label>
            {filteredActivities.length > 0 ? (
              <select
                value={selectedActivityId}
                onChange={(e) => setSelectedActivityId(Number(e.target.value))}
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              >
                {filteredActivities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                Keine Tätigkeiten für dieses Projekt vorhanden.
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
              Beschreibung / Notiz (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Kundengespräch, Bugfix Ticket #402..."
              className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
            />
          </div>

          {/* Tags & Billable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-500" />
                Tags (kommagetrennt)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="dev, meeting, intern"
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div className="flex items-center pt-5 sm:pt-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={billable}
                  onChange={(e) => setBillable(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-700 bg-slate-950"
                />
                <span className="text-xs text-slate-300">Abrechenbar (billable)</span>
              </label>
            </div>
          </div>

          {/* Big Start Button */}
          <button
            type="submit"
            disabled={!selectedProjectId || !selectedActivityId}
            className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 disabled:opacity-40 text-white font-bold text-base shadow-lg shadow-sky-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            Zeiterfassung jetzt starten
          </button>
        </form>
      )}
    </div>
  );
};
