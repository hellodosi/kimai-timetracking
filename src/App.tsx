/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  Folder,
  Database,
  Lock,
  Settings,
  RefreshCw,
  Plus,
  ShieldCheck,
  Building2,
  ListTodo,
} from 'lucide-react';
import { StorageService } from './services/storage';
import { EncryptionService } from './services/crypto';
import { KimaiApiService } from './services/kimaiApi';
import { VaultUnlockSetupModal } from './components/VaultUnlockSetupModal';
import { PinSetupModal } from './components/PinSetupModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TimerCard } from './components/TimerCard';
import { TimesheetHistoryView } from './components/TimesheetHistoryView';
import { MetadataView } from './components/MetadataView';
import { SettingsModal } from './components/SettingsModal';
import { ManualEntryModal } from './components/ManualEntryModal';
import { PWAInstallButton } from './components/PWAInstallButton';
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

  // Network listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check Kimai server reachability
  const checkKimaiServer = useCallback(
    async (cfgToTest?: KimaiConfig) => {
      const cfg = cfgToTest || config;
      if (!cfg || !cfg.baseUrl) return;

      setServerStatus((prev) => ({ ...prev, checking: true }));
      try {
        const status = await KimaiApiService.ping(cfg);
        setServerStatus(status);
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
    [config]
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
          }
        }
      } catch (err) {
        console.error('Failed to load local app data:', err);
      }
    },
    [checkKimaiServer, syncPendingTimesheets, refreshMetadataFromKimai]
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

    const beginIso = new Date().toISOString().replace('Z', '');
    const newTimer: ActiveTimer = {
      localId: 'timer_' + Date.now(),
      begin: beginIso,
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

    setActiveTimer(newTimer);
    await StorageService.saveActiveTimer(newTimer, activePin);
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;

    const endIso = new Date().toISOString().replace('Z', '');

    const completedEntry: TimesheetEntry = {
      localId: activeTimer.localId,
      remoteId: activeTimer.remoteId,
      begin: activeTimer.begin,
      end: endIso,
      projectId: activeTimer.projectId,
      projectName: activeTimer.projectName,
      customerName: activeTimer.customerName,
      activityId: activeTimer.activityId,
      activityName: activeTimer.activityName,
      description: activeTimer.description,
      tags: activeTimer.tags,
      billable: activeTimer.billable,
      syncStatus: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedTimesheets = [completedEntry, ...timesheets];
    setTimesheets(updatedTimesheets);
    setActiveTimer(null);

    await StorageService.saveActiveTimer(null, activePin);
    await StorageService.saveTimesheets(updatedTimesheets, activePin);

    // If Kimai server is reachable, auto-push immediately
    if (serverStatus.isReachable && config) {
      syncPendingTimesheets(updatedTimesheets, config);
    }
  };

  // Add manual entry
  const handleSaveManualEntry = async (
    entryData: Omit<TimesheetEntry, 'localId' | 'createdAt' | 'updatedAt' | 'syncStatus'>
  ) => {
    const newEntry: TimesheetEntry = {
      ...entryData,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 shadow-md shadow-sky-500/20 flex items-center justify-center text-white shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base text-white tracking-tight leading-none">
                Kimai Zeiterfassung
              </h1>
              <span className="text-[10px] text-slate-400 leading-none">
                {isPinSet ? 'PIN-Schutz aktiv' : 'Lokal gespeichert'}
              </span>
            </div>
          </div>

          {/* Action Badges */}
          <div className="flex items-center gap-2">
            <PWAInstallButton />

            {/* Server Reachability Status Pill */}
            <button
              onClick={() => checkKimaiServer()}
              disabled={serverStatus.checking}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                serverStatus.isReachable
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
              title="Klicken, um Verbindung zum Server zu prüfen"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  serverStatus.isReachable
                    ? 'bg-emerald-400'
                    : 'bg-slate-400'
                }`}
              />
              <span className="hidden sm:inline">
                {serverStatus.checking
                  ? 'Prüfe...'
                  : serverStatus.isReachable
                  ? 'Verbunden'
                  : 'Offline'}
              </span>
              <RefreshCw
                className={`w-3 h-3 text-slate-400 ${
                  serverStatus.checking ? 'animate-spin' : ''
                }`}
              />
            </button>

            {/* Lock Button (if PIN set) */}
            {isPinSet && (
              <button
                onClick={handleLockSession}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 cursor-pointer"
                title="App mit PIN sperren"
              >
                <Lock className="w-4 h-4 text-sky-400" />
              </button>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 cursor-pointer"
              title="Einstellungen"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Offline Banner & Connectivity Indicator */}
        <OfflineIndicator
          isOnline={isOnline}
          serverStatus={serverStatus}
          pendingSyncCount={pendingSyncCount}
          isSyncing={isSyncing}
          onCheckConnection={checkKimaiServer}
          onSyncPending={() => syncPendingTimesheets()}
        />

        {/* Sync Success Feedback Toast */}
        {syncFeedback && (
          <div className="bg-emerald-950/90 border-b border-emerald-800 px-4 py-2 text-xs text-emerald-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {syncFeedback}
            </span>
            <button
              onClick={() => setSyncFeedback(null)}
              className="text-emerald-400 hover:text-emerald-200 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="max-w-4xl mx-auto px-4 flex border-t border-slate-800/60">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition relative cursor-pointer ${
              activeTab === 'tracker'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Zeiterfassung</span>
            {activeTimer && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute right-2 top-3" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('timesheets')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition relative cursor-pointer ${
              activeTab === 'timesheets'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListTodo className="w-4 h-4" />
            <span>Zeiteinträge</span>
            {pendingSyncCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                {pendingSyncCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('metadata')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'metadata'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Stammdaten</span>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              ({metadata.projects.length} Projekte)
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-20">
        {activeTab === 'tracker' && (
          <div className="space-y-6">
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

            {/* Quick summary of today's work */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-400" />
                  Synchronisations-Status
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {pendingSyncCount > 0
                    ? `${pendingSyncCount} ${pendingSyncCount === 1 ? 'Eintrag' : 'Einträge'} ausstehend`
                    : 'Alle Einträge synchronisiert'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sie können die Zeiterfassung jederzeit starten und beenden. Die Daten werden offline zurückgehalten und automatisch gesendet, sobald der Server wieder erreichbar ist.
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
