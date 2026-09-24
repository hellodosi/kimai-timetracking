import React, { useState } from 'react';
import {
  X,
  Settings,
  ShieldCheck,
  KeyRound,
  Globe,
  QrCode,
  RefreshCw,
  Lock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  ShieldOff,
} from 'lucide-react';
import { QRCodeScannerModal } from './QRCodeScannerModal';
import { StorageService } from '../services/storage';
import type { KimaiConfig, ServerStatus } from '../types/kimai';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: KimaiConfig;
  serverStatus: ServerStatus;
  isPinSet: boolean;
  onSaveConfig: (updatedConfig: KimaiConfig) => Promise<void>;
  onLockSession: () => void;
  onCheckConnection: () => Promise<void>;
  onPinStatusChanged: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  serverStatus,
  isPinSet,
  onSaveConfig,
  onLockSession,
  onCheckConnection,
  onPinStatusChanged,
}) => {
  const [url, setUrl] = useState(config.baseUrl);
  const [apiToken, setApiToken] = useState(config.apiToken);
  const [showToken, setShowToken] = useState(false);

  // PIN settings state
  const [pinMode, setPinMode] = useState<'none' | 'set' | 'change' | 'remove'>('none');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  // General state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated: KimaiConfig = {
        baseUrl: url.trim(),
        apiToken: apiToken.trim(),
      };
      await onSaveConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    if (newPin.length < 4) {
      setPinError('Der PIN muss mindestens 4 Zeichen lang sein.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Die PINs stimmen nicht überein.');
      return;
    }

    try {
      await StorageService.setPin(newPin);
      setPinSuccess('PIN wurde erfolgreich aktiviert. Alle Daten sind nun verschlüsselt.');
      setNewPin('');
      setConfirmPin('');
      setPinMode('none');
      onPinStatusChanged();
    } catch (err: unknown) {
      setPinError((err as Error)?.message || 'Fehler beim Aktivieren des PINs.');
    }
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    if (newPin.length < 4) {
      setPinError('Der neue PIN muss mindestens 4 Zeichen lang sein.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Die neuen PINs stimmen nicht überein.');
      return;
    }

    const success = await StorageService.changePin(oldPin, newPin);
    if (success) {
      setPinSuccess('PIN wurde erfolgreich geändert und Daten wurden neu verschlüsselt.');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setPinMode('none');
      onPinStatusChanged();
    } else {
      setPinError('Der aktuelle PIN ist ungültig.');
    }
  };

  const handleRemovePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    const success = await StorageService.removePin(oldPin);
    if (success) {
      setPinSuccess('PIN-Verschlüsselung wurde deaktiviert.');
      setOldPin('');
      setPinMode('none');
      onPinStatusChanged();
    } else {
      setPinError('Der eingegebene PIN ist ungültig.');
    }
  };

  const exportJson = JSON.stringify(
    {
      url,
      token: apiToken,
    },
    null,
    2
  );

  const copyConfigToClipboard = () => {
    navigator.clipboard.writeText(exportJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden my-auto text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-white text-base">Einstellungen</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Kimai API Server Config */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Kimai Server-Verbindung
              </h4>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="text-xs text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 font-medium cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                Aus QR-Code scannen
              </button>
            </div>

            {/* Server Status pill */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    serverStatus.isReachable ? 'bg-emerald-400' : 'bg-slate-400'
                  }`}
                />
                <div>
                  <span className="font-semibold text-white block">
                    {serverStatus.isReachable ? 'Server erreichbar' : 'Server nicht erreichbar'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {serverStatus.kimaiVersion
                      ? `Kimai Version: ${serverStatus.kimaiVersion}`
                      : serverStatus.errorMessage || 'Keine Antwort'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onCheckConnection}
                disabled={serverStatus.checking}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${serverStatus.checking ? 'animate-spin' : ''}`} />
                Prüfen
              </button>
            </div>

            {/* URL */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                Server-URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full text-xs py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* API Token */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                  API-Token
                </span>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showToken ? 'Verbergen' : 'Anzeigen'}
                </button>
              </label>
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full text-xs py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Speichere...' : 'Konfiguration speichern'}
              </button>
              {saveSuccess && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Gespeichert
                </span>
              )}
            </div>
          </form>

          {/* Security & PIN Section */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Lokale Verschlüsselung & PIN
              </h4>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  isPinSet
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isPinSet ? 'Aktiv (AES-256)' : 'Inaktiv (Standard)'}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Ein optionaler PIN schützt Ihre Token und gespeicherten Zeiten zusätzlich mit AES-256-Verschlüsselung im Browser.
            </p>

            {pinError && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 text-rose-300 text-xs border border-rose-800/60">
                {pinError}
              </div>
            )}
            {pinSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 text-emerald-300 text-xs border border-emerald-800/60">
                {pinSuccess}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {!isPinSet ? (
                <button
                  type="button"
                  onClick={() => setPinMode(pinMode === 'set' ? 'none' : 'set')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition cursor-pointer"
                >
                  {pinMode === 'set' ? 'Abbrechen' : 'PIN aktivieren'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setPinMode(pinMode === 'change' ? 'none' : 'change')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
                  >
                    {pinMode === 'change' ? 'Abbrechen' : 'PIN ändern'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPinMode(pinMode === 'remove' ? 'none' : 'remove')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-medium transition cursor-pointer"
                  >
                    {pinMode === 'remove' ? 'Abbrechen' : 'PIN entfernen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLockSession();
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    App jetzt sperren
                  </button>
                </>
              )}
            </div>

            {/* Set PIN Form */}
            {pinMode === 'set' && (
              <form onSubmit={handleSetPinSubmit} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs text-white font-medium block">Neuen PIN festlegen:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Neuer PIN</label>
                    <input
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Bestätigen</label>
                    <input
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer"
                >
                  PIN aktivieren & Daten verschlüsseln
                </button>
              </form>
            )}

            {/* Change PIN Form */}
            {pinMode === 'change' && (
              <form onSubmit={handleChangePinSubmit} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs text-white font-medium block">PIN ändern:</span>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Aktueller PIN</label>
                  <input
                    type="password"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value)}
                    className="w-full py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Neuer PIN</label>
                    <input
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Bestätigen</label>
                    <input
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium cursor-pointer"
                >
                  Neuen PIN aktivieren
                </button>
              </form>
            )}

            {/* Remove PIN Form */}
            {pinMode === 'remove' && (
              <form onSubmit={handleRemovePinSubmit} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs text-white font-medium block">PIN-Schutz aufheben:</span>
                <p className="text-[11px] text-slate-400">
                  Geben Sie Ihren aktuellen PIN ein, um die Daten zu entschlüsseln und den PIN-Schutz zu entfernen.
                </p>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Aktueller PIN</label>
                  <input
                    type="password"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value)}
                    className="w-full py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer"
                >
                  PIN entfernen
                </button>
              </form>
            )}
          </div>

          {/* Export Config JSON for QR / Backup */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Konfiguration als JSON (für QR-Codes)
              </h4>
              <button
                type="button"
                onClick={copyConfigToClipboard}
                className="text-xs text-sky-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                {copiedJson ? 'Kopiert!' : 'In Zwischenablage kopieren'}
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto">
              {exportJson}
            </pre>
          </div>

          {/* Danger Zone: Reset */}
          <div className="pt-4 border-t border-rose-950/40">
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    'Möchten Sie wirklich alle lokal gespeicherten Daten (inkl. noch nicht synchronisierter Zeiten) und Konfigurationen löschen?'
                  )
                ) {
                  StorageService.clearAll();
                  window.location.reload();
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Alle lokalen Daten löschen
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>

      <QRCodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(p) => {
          setUrl(p.url);
          if (p.token) setApiToken(p.token);
        }}
      />
    </div>
  );
};
