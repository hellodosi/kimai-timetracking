/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  Database,
  Lock,
  Settings,
  RefreshCw,
  ListTodo,
  X,
} from 'lucide-react';
import { StorageService } from './services/storage';
import { EncryptionService } from './services/crypto';
import { KimaiApiService, formatKimaiDateTime } from './services/kimaiApi';
import { VaultUnlockSetupModal } from './components/VaultUnlockSetupModal';
import { PinSetupModal } from './components/PinSetupModal';
import { TimerCard } from './components/TimerCard';
import { TimesheetHistoryView } from './components/TimesheetHistoryView';
import { MetadataView } from './components/MetadataView';
import { SettingsModal } from './components/SettingsModal';
import { ManualEntryModal } from './components/ManualEntryModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { AppLogo } from './components/AppLogo';
import type {
  KimaiConfig,
  TimesheetEntry,
  ActiveTimer,
  CachedMetadata,
  ServerStatus,
} from './types/kimai';

export default function App() {
  // App initialization & vault state
  const [isConfigured, setIsConfigured] = useState<boolean>(() =>
    StorageService.isConfigured()
  );
  const [isPinSet, setIsPinSet] = useState<boolean>(() =>
    StorageService.isPinSet()
  );
  // If not configured, or if PIN is set and session is not unlocked, show login/unlock
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (!StorageService.isConfigured()) return false;
    if (StorageService.isPinSet()) {
      return EncryptionService.isSessionUnlocked();
    }
    return true; // No PIN configured = unlocked by default
  });
  const [activePin, setActivePin] = useState<string>(() =>
    EncryptionService.getSessionPin() || ''
  );

  // Core application data
  const [config, setConfig] = useState<KimaiConfig | null>(null);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const activeTimerRef = useRef<ActiveTimer | null>(activeTimer);
  activeTimerRef.current = activeTimer;
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [metadata, setMetadata] = useState<CachedMetadata>({
    customers: [],
    projects: [],
    activities: [],
    lastSyncedAt: null,
  });

  // Connectivity & Sync state
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    isReachable: false,
    checking: false,
    lastChecked: null,
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Active UI Navigation Tab
  const [activeTab, setActiveTab] = useState<'tracker' | 'timesheets' | 'metadata'>('tracker');

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false);

  // Network listener & visibility sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkKimaiServer();
    };
    const handleOffline = () => setIsOnline(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkKimaiServer();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic sync every 25 seconds to keep active timer state in sync with PC / Kimai
    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        checkKimaiServer();
      }
    }, 25000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [config]);

  // Synchronize active running timer from Kimai server (e.g. started on PC)
  const syncActiveTimerFromKimai = useCallback(
    async (cfgToUse?: KimaiConfig, metaToUse?: CachedMetadata) => {
      const cfg = cfgToUse || config;
      if (!cfg || !cfg.baseUrl) return;
      const currentMeta = metaToUse || metadata;

      try {
        const activeList = await KimaiApiService.fetchActiveTimesheets(cfg);
        if (Array.isArray(activeList) && activeList.length > 0) {
          const item = activeList[0];

          // If local active timer already represents this remote timer, don't overwrite or notify
          const currentLocal = activeTimerRef.current;
          if (currentLocal && Number(currentLocal.remoteId) === Number(item.id)) {
            return;
          }

          let projectId = 0;
          let projectName = 'Projekt';
          let customerName = '';

          if (typeof item.project === 'object' && item.project) {
            projectId = item.project.id;
            projectName = item.project.name || `Projekt #${projectId}`;
            if (item.project.customer && typeof item.project.customer === 'object') {
              customerName = item.project.customer.name || '';
            }
          } else if (typeof item.project === 'number') {
            projectId = item.project;
            const p = currentMeta.projects.find((proj) => proj.id === projectId);
            if (p) {
              projectName = p.name;
              const c = currentMeta.customers.find((cust) => cust.id === (typeof p.customer === 'object' ? p.customer.id : p.customer));
              if (c) customerName = c.name;
            }
          }

          let activityId = 0;
          let activityName = 'Tätigkeit';
          if (typeof item.activity === 'object' && item.activity) {
            activityId = item.activity.id;
            activityName = item.activity.name || `Tätigkeit #${activityId}`;
          } else if (typeof item.activity === 'number') {
            activityId = item.activity;
            const a = currentMeta.activities.find((act) => act.id === activityId);
            if (a) activityName = a.name;
          }

          const tags: string[] = [];
          if (Array.isArray(item.tags)) {
            for (const t of item.tags) {
              if (typeof t === 'string') tags.push(t);
              else if (t && typeof t === 'object' && t.name) tags.push(t.name);
            }
          } else if (typeof item.tags === 'string' && item.tags.trim()) {
            tags.push(...item.tags.split(',').map((s: string) => s.trim()).filter(Boolean));
          }

          const startMs = new Date(item.begin).getTime();
          const remoteActiveTimer: ActiveTimer = {
            localId: 'kimai_' + item.id,
            remoteId: item.id,
            begin: formatKimaiDateTime(item.begin),
            startTimestamp: isNaN(startMs) ? Date.now() : startMs,
            projectId,
            projectName,
            customerName,
            activityId,
            activityName,
            description: item.description || '',
            tags,
            billable: Boolean(item.billable ?? true),
            isRunning: true,
          };

          setActiveTimer(remoteActiveTimer);
          await StorageService.saveActiveTimer(remoteActiveTimer, activePin);
        } else {
          // If Kimai server reports NO active timer running:
          // Check if local active timer had a remoteId (was started on/synced with Kimai)
          // That means user stopped it externally / on PC!
          if (activeTimer && activeTimer.remoteId) {
            setActiveTimer(null);
            await StorageService.saveActiveTimer(null, activePin);
            setSyncFeedback('Timer wurde am PC beendet.');
            setTimeout(() => setSyncFeedback(null), 3000);
          }
        }
      } catch (err) {
        console.warn('Could not sync active timer from Kimai:', err);
      }
    },
    [config, activeTimer, activePin, metadata]
  );

  // Check Kimai server reachability
  const checkKimaiServer = useCallback(
    async (cfgToTest?: KimaiConfig) => {
      const cfg = cfgToTest || config;
      if (!cfg || !cfg.baseUrl) return;

      setServerStatus((prev) => ({ ...prev, checking: true }));
      try {
        const status = await KimaiApiService.ping(cfg);
        setServerStatus(status);
        if (status.isReachable) {
          syncActiveTimerFromKimai(cfg);
        }
        return status;
      } catch (err: unknown) {
        setServerStatus({
          isReachable: false,
          checking: false,
          lastChecked: Date.now(),
          errorMessage: (err as Error)?.message || 'Server nicht erreichbar',
        });
        return { isReachable: false, checking: false, lastChecked: Date.now() };
      }
    },
    [config, syncActiveTimerFromKimai]
  );

  // Sync pending timesheets with Kimai API
  const syncPendingTimesheets = useCallback(
    async (currentTimesheets?: TimesheetEntry[], currentConfig?: KimaiConfig) => {
      const targetConfig = currentConfig || config;
      const targetTimesheets = currentTimesheets || timesheets;

      if (!targetConfig || isSyncing) return;

      const pending = targetTimesheets.filter(
        (t) => t.syncStatus === 'pending' || t.syncStatus === 'failed'
      );
      if (pending.length === 0) return;

      setIsSyncing(true);
      setSyncFeedback(null);

      const updated = [...targetTimesheets];
      let syncedCount = 0;

      for (const entry of pending) {
        try {
          const idx = updated.findIndex((t) => t.localId === entry.localId);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], syncStatus: 'syncing' };
            setTimesheets([...updated]);
          }

          const response = await KimaiApiService.postCompletedTimesheet(targetConfig, entry);

          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              remoteId: response.id,
              end: response.adjustedEnd || updated[idx].end,
              syncStatus: 'synced',
              syncError: undefined,
              updatedAt: Date.now(),
            };
            syncedCount++;
          }
        } catch (err: unknown) {
          const idx = updated.findIndex((t) => t.localId === entry.localId);
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              syncStatus: 'failed',
              syncError: (err as Error)?.message || 'Übertragung zurückgehalten',
            };
          }
        }
      }

      setTimesheets(updated);
      await StorageService.saveTimesheets(updated, activePin);
      setIsSyncing(false);

      if (syncedCount > 0) {
        setSyncFeedback(
          `${syncedCount} ${syncedCount === 1 ? 'Eintrag' : 'Einträge'} synchronisiert!`
        );
        setTimeout(() => setSyncFeedback(null), 4000);
      }
    },
    [config, timesheets, isSyncing, activePin]
  );

  // Fetch / refresh metadata from Kimai
  const refreshMetadataFromKimai = useCallback(
    async (cfgToUse?: KimaiConfig) => {
      const cfg = cfgToUse || config;
      if (!cfg) return;

      setIsSyncing(true);
      try {
        const [customers, projects, activities] = await Promise.all([
          KimaiApiService.fetchCustomers(cfg),
          KimaiApiService.fetchProjects(cfg),
          KimaiApiService.fetchActivities(cfg),
        ]);

        const newMeta: CachedMetadata = {
          customers,
          projects,
          activities,
          lastSyncedAt: Date.now(),
        };

        setMetadata(newMeta);
        await StorageService.saveMetadata(newMeta, activePin);
        setSyncFeedback('Projekte und Aufgaben aktualisiert.');
        setTimeout(() => setSyncFeedback(null), 3000);
      } catch (err: unknown) {
        console.error('Metadata sync error:', err);
      } finally {
        setIsSyncing(false);
      }
    },
    [config, activePin]
  );

  // Load application data (from local storage / decrypted storage)
  const loadAppData = useCallback(
    async (pin?: string) => {
      if (pin) setActivePin(pin);
      setIsUnlocked(true);

      try {
        const [loadedConfig, loadedTimer, loadedTimesheets, loadedMeta] = await Promise.all([
          StorageService.getConfig(pin),
          StorageService.getActiveTimer(pin),
          StorageService.getTimesheets(pin),
          StorageService.getMetadata(pin),
        ]);

        setConfig(loadedConfig);
        setActiveTimer(loadedTimer);
        setTimesheets(loadedTimesheets || []);
        if (loadedMeta) {
          setMetadata(loadedMeta);
        }

        // On open: check if Kimai API server is reachable and auto-sync
        if (loadedConfig) {
          const status = await checkKimaiServer(loadedConfig);
          if (status?.isReachable) {
            await syncPendingTimesheets(loadedTimesheets, loadedConfig);
            if (!loadedMeta || !loadedMeta.lastSyncedAt || loadedMeta.projects.length === 0) {
              await refreshMetadataFromKimai(loadedConfig);
            }
            await syncActiveTimerFromKimai(loadedConfig, loadedMeta);
          }
        }
      } catch (err) {
        console.error('Failed to load local app data:', err);
      }
    },
    [checkKimaiServer, syncPendingTimesheets, refreshMetadataFromKimai, syncActiveTimerFromKimai]
  );

  // Auto-load data if configured and not PIN protected
  useEffect(() => {
    if (isConfigured && !isPinSet && !config) {
      loadAppData();
    }
  }, [isConfigured, isPinSet, config, loadAppData]);

  // Handle successful login (Step 1)
  const handleLoginSuccess = async (newConfig: KimaiConfig) => {
    setIsConfigured(true);
    setConfig(newConfig);
    setIsUnlocked(true);

    // Initial check and metadata fetch
    const status = await checkKimaiServer(newConfig);
    if (status?.isReachable) {
      await refreshMetadataFromKimai(newConfig);
    }

    // Step 2: Ask user optionally if they want to protect their app with a PIN
    setIsPinPromptOpen(true);
  };

  // Lock session manually (only applies if PIN is active)
  const handleLockSession = () => {
    if (StorageService.isPinSet()) {
      EncryptionService.lockSession();
      setIsUnlocked(false);
      setActivePin('');
      setConfig(null);
      setActiveTimer(null);
      setTimesheets([]);
    }
  };

  // Timer actions
  const handleStartTimer = async (params: {
    projectId: number;
    activityId: number;
    description: string;
    tags: string[];
    billable: boolean;
  }) => {
    const proj = metadata.projects.find((p) => p.id === params.projectId);
    const act = metadata.activities.find((a) => a.id === params.activityId);

    let customerName = '';
    if (proj) {
      if (typeof proj.customer === 'object' && proj.customer?.name) {
        customerName = proj.customer.name;
      } else {
        const cust = metadata.customers.find((c) => c.id === proj.customer);
        if (cust) customerName = cust.name;
      }
    }

    const now = Date.now();
    const beginIso = formatKimaiDateTime(new Date(now));
    const newTimer: ActiveTimer = {
      localId: 'timer_' + now,
      begin: beginIso,
      startTimestamp: now,
      projectId: params.projectId,
      projectName: proj ? proj.name : `Projekt #${params.projectId}`,
      customerName,
      activityId: params.activityId,
      activityName: act ? act.name : `Tätigkeit #${params.activityId}`,
      description: params.description,
      tags: params.tags,
      billable: params.billable,
      isRunning: true,
    };

    // If server reachable, immediately launch timer on Kimai so it's running live on PC!
    if (serverStatus.isReachable && config) {
      try {
        const remoteRes = await KimaiApiService.startTimesheet(config, {
          begin: beginIso,
          project: params.projectId,
          activity: params.activityId,
          description: params.description,
          tags: params.tags,
          billable: params.billable,
        });
        if (remoteRes?.id) {
          newTimer.remoteId = remoteRes.id;
          setSyncFeedback('Timer auf Server gestartet.');
          setTimeout(() => setSyncFeedback(null), 3000);
        }
      } catch (err: unknown) {
        console.warn('Konnte Timer nicht sofort auf Kimai starten:', err);
      }
    }

    setActiveTimer(newTimer);
    await StorageService.saveActiveTimer(newTimer, activePin);
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;

    const now = Date.now();
    let startMs = activeTimer.startTimestamp;
    if (!startMs && activeTimer.localId.startsWith('timer_')) {
      const idTimestamp = Number(activeTimer.localId.replace('timer_', ''));
      if (!isNaN(idTimestamp) && idTimestamp > 0) {
        startMs = idTimestamp;
      }
    }
    if (!startMs) {
      startMs = new Date(activeTimer.begin).getTime();
    }
    const startDt = new Date(startMs);
    let endDt = new Date(now);
    // Ensure duration is at least 60 seconds (1 minute) so Kimai validator does not reject 0-second timers
    if (endDt.getTime() <= startDt.getTime() + 60000) {
      endDt = new Date(startDt.getTime() + 60000);
    }
    const beginIso = formatKimaiDateTime(startDt);
    const endIso = formatKimaiDateTime(endDt);

    let stoppedRemote = false;
    let remoteRecord: any = null;

    // If timer was running on Kimai and server is reachable, stop it directly on Kimai!
    if (activeTimer.remoteId && serverStatus.isReachable && config) {
      try {
        remoteRecord = await KimaiApiService.stopTimesheet(config, activeTimer.remoteId);
        stoppedRemote = true;
        setSyncFeedback('Timer auf Server gestoppt & gespeichert.');
        setTimeout(() => setSyncFeedback(null), 3000);
      } catch (err) {
        console.warn('Fehler beim Stoppen auf Kimai-Server:', err);
      }
    }

    const completedEntry: TimesheetEntry = {
      localId: activeTimer.localId,
      remoteId: activeTimer.remoteId,
      begin: remoteRecord?.begin ? formatKimaiDateTime(remoteRecord.begin) : beginIso,
      end: remoteRecord?.end ? formatKimaiDateTime(remoteRecord.end) : endIso,
      projectId: activeTimer.projectId,
      projectName: activeTimer.projectName,
      customerName: activeTimer.customerName,
      activityId: activeTimer.activityId,
      activityName: activeTimer.activityName,
      description: activeTimer.description,
      tags: activeTimer.tags,
      billable: activeTimer.billable,
      syncStatus: stoppedRemote ? 'synced' : 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const updatedTimesheets = [completedEntry, ...timesheets];
    setTimesheets(updatedTimesheets);
    setActiveTimer(null);

    await StorageService.saveActiveTimer(null, activePin);
    await StorageService.saveTimesheets(updatedTimesheets, activePin);

    // If not stopped on Kimai remotely (e.g. was offline or created offline), sync via postCompletedTimesheet
    if (!stoppedRemote && serverStatus.isReachable && config) {
      syncPendingTimesheets(updatedTimesheets, config);
    }
  };

  // Add manual entry
  const handleSaveManualEntry = async (
    entryData: Omit<TimesheetEntry, 'localId' | 'createdAt' | 'updatedAt' | 'syncStatus'>
  ) => {
    const startDt = new Date(entryData.begin);
    let endDt = new Date(entryData.end || new Date());
    if (endDt.getTime() <= startDt.getTime()) {
      endDt = new Date(startDt.getTime() + 60000);
    }

    const newEntry: TimesheetEntry = {
      ...entryData,
      begin: formatKimaiDateTime(startDt),
      end: formatKimaiDateTime(endDt),
      localId: 'entry_' + Date.now(),
      syncStatus: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updated = [newEntry, ...timesheets];
    setTimesheets(updated);
    await StorageService.saveTimesheets(updated, activePin);

    if (serverStatus.isReachable && config) {
      syncPendingTimesheets(updated, config);
    }
  };

  const handleDeleteEntry = async (localId: string) => {
    const updated = timesheets.filter((t) => t.localId !== localId);
    setTimesheets(updated);
    await StorageService.saveTimesheets(updated, activePin);
  };

  const pendingSyncCount = timesheets.filter(
    (t) => t.syncStatus === 'pending' || t.syncStatus === 'failed'
  ).length;

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Top Application Navigation Bar with Safe Area Top Padding */}
      <header className="shrink-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 pt-safe z-30">
        <div className="max-w-4xl mx-auto px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <AppLogo className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-md shadow-sky-950 shrink-0" />
            <div className="truncate">
              <h1 className="font-bold text-sm sm:text-base text-white tracking-tight leading-none truncate">
                Zeiterfassung
              </h1>
            </div>
          </div>

          {/* Action Items in Header */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton />

            {/* Server Reachability Badge */}
            <button
              onClick={() => checkKimaiServer()}
              disabled={serverStatus.checking}
              className={`flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer active:scale-95 ${
                serverStatus.isReachable
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              }`}
              title={
                serverStatus.isReachable
                  ? 'Server verbunden (Online)'
                  : 'Server nicht erreichbar (Offline) - Klicken zum Prüfen'
              }
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  serverStatus.checking
                    ? 'bg-amber-400 animate-ping'
                    : serverStatus.isReachable
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] font-medium hidden xs:inline">
                {serverStatus.checking
                  ? 'Prüfe...'
                  : serverStatus.isReachable
                  ? 'Online'
                  : 'Offline'}
              </span>
              <RefreshCw
                className={`w-3 h-3 ${
                  serverStatus.isReachable ? 'text-emerald-400/80' : 'text-amber-400/80'
                } ${serverStatus.checking ? 'animate-spin' : ''}`}
              />
            </button>

            {/* Lock Button (only if PIN set) */}
            {isPinSet && (
              <button
                onClick={handleLockSession}
                className="p-1.5 sm:p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 active:scale-95 cursor-pointer"
                title="App sperren"
                aria-label="App sperren"
              >
                <Lock className="w-4 h-4 text-sky-400" />
              </button>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 active:scale-95 cursor-pointer"
              title="Einstellungen"
              aria-label="Einstellungen"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Floating Non-Intrusive Toast (Zero Layout Shift) */}
      <div
        className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none ${
          syncFeedback
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
        }`}
      >
        {syncFeedback && (
          <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-xs shadow-2xl shadow-black/70 max-w-[90vw]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-medium truncate">{syncFeedback}</span>
            <button
              onClick={() => setSyncFeedback(null)}
              className="ml-1 p-0.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
              aria-label="Schließen"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area - Native Scrollable Container with Hidden Scrollbars */}
      <main className="flex-1 overflow-y-auto no-scrollbar overscroll-contain w-full max-w-4xl mx-auto p-3.5 sm:p-6">
        {activeTab === 'tracker' && (
          <div className="space-y-4 sm:space-y-6">
            <TimerCard
              activeTimer={activeTimer}
              projects={metadata.projects}
              customers={metadata.customers}
              activities={metadata.activities}
              isOnline={isOnline}
              isKimaiConnected={serverStatus.isReachable}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
            />

            {/* Quick Summary Pill */}
            <div className="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  Synchronisation
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {pendingSyncCount > 0
                    ? `${pendingSyncCount} ausstehend`
                    : 'Alle Zeiten aktuell'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Zeiten werden lokal vorgehalten und automatisch synchronisiert, sobald Kimai erreichbar ist.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'timesheets' && (
          <TimesheetHistoryView
            entries={timesheets}
            isSyncing={isSyncing}
            isKimaiConnected={serverStatus.isReachable}
            onSyncAll={() => syncPendingTimesheets()}
            onDeleteEntry={handleDeleteEntry}
            onOpenManualModal={() => setIsManualModalOpen(true)}
          />
        )}

        {activeTab === 'metadata' && (
          <MetadataView
            customers={metadata.customers}
            projects={metadata.projects}
            activities={metadata.activities}
            lastSyncedAt={metadata.lastSyncedAt}
            isSyncing={isSyncing}
            isKimaiConnected={serverStatus.isReachable}
            onRefreshMetadata={() => refreshMetadataFromKimai()}
          />
        )}
      </main>

      {/* Native Bottom App Bar (Optimized for Mobile Thumb Navigation & Safe Area) */}
      <nav className="shrink-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 pb-safe z-30">
        <div className="max-w-md mx-auto grid grid-cols-3 px-2 py-1">
          {/* Tab 1: Timer */}
          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition cursor-pointer active:scale-95 relative ${
              activeTab === 'tracker'
                ? 'text-sky-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 font-normal'
            }`}
          >
            <div className="relative">
              <Clock className="w-5 h-5" />
              {activeTimer && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-1" />
              )}
            </div>
            <span className="text-[11px] mt-1 tracking-tight">Erfassung</span>
          </button>

          {/* Tab 2: Timesheets */}
          <button
            onClick={() => setActiveTab('timesheets')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition cursor-pointer active:scale-95 relative ${
              activeTab === 'timesheets'
                ? 'text-sky-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 font-normal'
            }`}
          >
            <div className="relative">
              <ListTodo className="w-5 h-5" />
              {pendingSyncCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black rounded-full text-[9px]">
                  {pendingSyncCount}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 tracking-tight">Einträge</span>
          </button>

          {/* Tab 3: Stammdaten */}
          <button
            onClick={() => setActiveTab('metadata')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition cursor-pointer active:scale-95 relative ${
              activeTab === 'metadata'
                ? 'text-sky-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 font-normal'
            }`}
          >
            <Database className="w-5 h-5" />
            <span className="text-[11px] mt-1 tracking-tight">Stammdaten</span>
          </button>
        </div>
      </nav>

      {/* Manual Entry Modal */}
      <ManualEntryModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        projects={metadata.projects}
        customers={metadata.customers}
        activities={metadata.activities}
        onSaveEntry={handleSaveManualEntry}
      />

      {/* Settings Modal */}
      {config && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          config={config}
          serverStatus={serverStatus}
          isPinSet={isPinSet}
          onSaveConfig={async (updatedConfig) => {
            setConfig(updatedConfig);
            await StorageService.saveConfig(updatedConfig, activePin);
            await checkKimaiServer(updatedConfig);
          }}
          onLockSession={handleLockSession}
          onCheckConnection={async () => {
            await checkKimaiServer(config);
          }}
          onPinStatusChanged={() => {
            setIsPinSet(StorageService.isPinSet());
          }}
          onClearOfflineCache={async () => {
            const count = await StorageService.clearOfflineTimesheets(activePin);
            const remaining = await StorageService.getTimesheets(activePin);
            setTimesheets(remaining);
            setActiveTimer(null);
            return count;
          }}
        />
      )}

      {/* Optional PIN Setup Prompt after successful Login (Step 2) */}
      <PinSetupModal
        isOpen={isPinPromptOpen}
        onClose={() => setIsPinPromptOpen(false)}
        onSuccess={(pin) => {
          setActivePin(pin);
          setIsPinSet(true);
        }}
      />

      {/* Login Screen (if not configured) OR PIN Unlock Screen (if PIN is set and session locked) */}
      {(!isConfigured || (isPinSet && !isUnlocked)) && (
        <VaultUnlockSetupModal
          isConfigured={isConfigured}
          isPinSet={isPinSet}
          onUnlocked={(pin) => loadAppData(pin)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
