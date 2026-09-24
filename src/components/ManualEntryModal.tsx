import React, { useState } from 'react';
import { X, Plus, Calendar, Clock, Folder, CheckSquare, Tag, AlignLeft } from 'lucide-react';
import type { Customer, Project, Activity, TimesheetEntry } from '../types/kimai';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  customers: Customer[];
  activities: Activity[];
  onSaveEntry: (entry: Omit<TimesheetEntry, 'localId' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  isOpen,
  onClose,
  projects,
  customers,
  activities,
  onSaveEntry,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('12:00');
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>(
    projects.length > 0 ? projects[0].id : ''
  );
  const [selectedActivityId, setSelectedActivityId] = useState<number | ''>(
    activities.length > 0 ? activities[0].id : ''
  );
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [billable, setBillable] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredActivities = activities.filter((act) => {
    if (!act.project) return true;
    return act.project === Number(selectedProjectId);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedProjectId || !selectedActivityId) {
      setErrorMsg('Bitte wählen Sie ein Projekt und eine Tätigkeit.');
      return;
    }

    const beginIso = `${date}T${startTime}:00`;
    const endIso = `${date}T${endTime}:00`;

    if (new Date(endIso).getTime() <= new Date(beginIso).getTime()) {
      setErrorMsg('Die Endzeit muss nach der Startzeit liegen.');
      return;
    }

    const proj = projects.find((p) => p.id === Number(selectedProjectId));
    const act = activities.find((a) => a.id === Number(selectedActivityId));

    let customerName = '';
    if (proj) {
      if (typeof proj.customer === 'object' && proj.customer?.name) {
        customerName = proj.customer.name;
      } else {
        const cust = customers.find((c) => c.id === proj.customer);
        if (cust) customerName = cust.name;
      }
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSaveEntry({
      begin: beginIso,
      end: endIso,
      projectId: Number(selectedProjectId),
      projectName: proj ? proj.name : `Projekt #${selectedProjectId}`,
      customerName,
      activityId: Number(selectedActivityId),
      activityName: act ? act.name : `Tätigkeit #${selectedActivityId}`,
      description,
      tags,
      billable,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden my-auto text-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-white text-sm">Zeiteintrag manuell erfassen</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              Datum
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Start and End Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Von (Start)
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                Bis (Ende)
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Project */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-sky-400" />
              Projekt
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(Number(e.target.value));
                setSelectedActivityId('');
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Activity */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
              Tätigkeit
            </label>
            <select
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(Number(e.target.value))}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500"
            >
              {filteredActivities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
              Beschreibung (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Was wurde erledigt?"
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Tags & Billable */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-500" />
                Tags
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="dev, support"
                className="w-full py-1.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
              />
            </div>
            <div className="pt-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={billable}
                  onChange={(e) => setBillable(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-700 bg-slate-950"
                />
                <span className="text-xs text-slate-300">Abrechenbar</span>
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow"
            >
              Eintrag speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
