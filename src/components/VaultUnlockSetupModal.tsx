import React, { useState } from 'react';
import {
  KeyRound,
  Globe,
  QrCode,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Info,
  PenLine,
} from 'lucide-react';
import { QRCodeScannerModal } from './QRCodeScannerModal';
import { AppLogo } from './AppLogo';
import { StorageService } from '../services/storage';
import { KimaiApiService } from '../services/kimaiApi';
import type { KimaiConfig } from '../types/kimai';

interface VaultUnlockSetupModalProps {
  isConfigured: boolean;
  isPinSet: boolean;
  onUnlocked: (pin?: string) => void;
  onLoginSuccess: (config: KimaiConfig) => void;
}

export const VaultUnlockSetupModal: React.FC<VaultUnlockSetupModalProps> = ({
  isConfigured,
  isPinSet,
  onUnlocked,
  onLoginSuccess,
}) => {
  // Login form state (Only Server URL and API Token)
  const [url, setUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // Unlock state (if PIN was optionally enabled)
  const [unlockPin, setUnlockPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // QR Scanner modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Handle unlock when PIN was set
  const handleUnlockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!unlockPin.trim()) return;

    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const isValid = await StorageService.verifyPin(unlockPin.trim());
      if (isValid) {
        onUnlocked(unlockPin.trim());
      } else {
        setErrorMsg('Falscher PIN! Bitte prüfen Sie Ihre Eingabe.');
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Fehler beim Entsperren.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle initial login / setup
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUrl = url.trim();
    const cleanToken = apiToken.trim();

    if (!cleanUrl) {
      setErrorMsg('Bitte geben Sie die Kimai Server-URL ein.');
      return;
    }
    if (!cleanToken) {
      setErrorMsg('Bitte geben Sie Ihr API-Passwort / Token ein.');
      return;
    }

    setIsProcessing(true);
    try {
      const newConfig: KimaiConfig = {
        baseUrl: cleanUrl,
        apiToken: cleanToken,
      };

      // Test connection if online, but do not block user if offline
      try {
        const pingResult = await KimaiApiService.ping(newConfig, 3000);
        if (pingResult.errorMessage && pingResult.errorMessage.includes('autorisiert')) {
          // If server responded with 401/403, warn user about wrong credentials
          setErrorMsg(pingResult.errorMessage);
          setIsProcessing(false);
          return;
        }
      } catch {
        // If offline or unreachable, proceed anyway: the app is designed to work offline!
      }

      await StorageService.initializeConnection(newConfig);
      onLoginSuccess(newConfig);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Fehler beim Speichern der Verbindungsdaten.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQRSuccess = (payload: { url: string; token: string }) => {
    setUrl(payload.url);
    if (payload.token) setApiToken(payload.token);
    setShowManualInput(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 text-slate-100 my-auto">
        {/* Top Header */}
        <div className="flex flex-col items-center text-center mb-6">
          {/* Prominent App Logo */}
          <div className="relative mb-3 group">
            <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-tr from-sky-500 to-cyan-400 opacity-40 blur-md group-hover:opacity-70 transition duration-300"></div>
            <AppLogo className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-xl shadow-sky-950" />
          </div>

          {isConfigured && isPinSet ? (
            <>
              <h2 className="text-xl font-bold text-white tracking-tight">App entsperren</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Geben Sie Ihren Sicherheits-PIN ein, um Ihre Zeiterfassung zu öffnen.
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-400 text-xs font-medium mb-2.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Sicherer lokaler Speicher</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-1.5">
                Verbinden Sie Ihre Kimai-Instanz
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                {showManualInput
                  ? 'Geben Sie Ihre Zugangsdaten ein, um die mobile Zeiterfassung zu starten.'
                  : 'Wählen Sie eine Methode, um Ihre Kimai-Instanz zu verbinden. Ihre Daten werden verschlüsselt gespeichert.'}
              </p>
            </>
          )}
        </div>

        {errorMsg && (
          <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isConfigured && isPinSet ? (
          /* PIN UNLOCK FORM */
          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                Sicherheits-PIN
              </label>
              <input
                type="password"
                autoFocus
                maxLength={12}
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value)}
                placeholder="••••"
                className="w-full text-center text-2xl tracking-[0.5em] py-3 px-4 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing || !unlockPin}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? 'Entsperren...' : 'App entsperren'}
            </button>

            <div className="pt-4 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Möchten Sie wirklich alle lokal gespeicherten Daten zurücksetzen?')) {
                    StorageService.clearAll();
                    window.location.reload();
                  }
                }}
                className="text-[11px] text-slate-500 hover:text-rose-400 underline transition cursor-pointer"
              >
                PIN vergessen? Lokale Daten zurücksetzen
              </button>
            </div>
          </form>
        ) : !showManualInput ? (
          /* TWO PROMINENT BUTTONS: QR CODE SCANNER & MANUAL ENTRY */
          <div className="space-y-3">
            {/* Big Button 1: QR Code Scanner */}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-medium shadow-lg shadow-sky-900/30 transition-all active:scale-[0.99] flex items-center gap-4 text-left group cursor-pointer border border-sky-400/20"
            >
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                <QrCode className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold flex items-center justify-between">
                  <span>QR-Code scannen</span>
                  <ArrowRight className="w-4 h-4 text-sky-200 group-hover:translate-x-1 transition" />
                </div>
                <p className="text-xs text-sky-100/80 mt-0.5 leading-snug">
                  Schnell &amp; fehlerfrei über die Kimai-Weboberfläche verbinden
                </p>
              </div>
            </button>

            {/* Big Button 2: Manual Input */}
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white font-medium border border-slate-700/80 hover:border-slate-600 shadow-md transition-all active:scale-[0.99] flex items-center gap-4 text-left group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                <PenLine className="w-6 h-6 text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold flex items-center justify-between">
                  <span>Manuelle Eingabe</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                  Server-URL und API-Passwort / Token von Hand eingeben
                </p>
              </div>
            </button>

            {/* PWA Tip Card */}
            <div className="mt-5 p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/40 flex items-start gap-2.5 text-xs text-sky-300">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Tipp: Sie können die App zum Startbildschirm hinzufügen (PWA), um sie wie eine native App auch offline zu nutzen.
              </span>
            </div>
          </div>
        ) : (
          /* MANUAL SETUP FORM */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={() => setShowManualInput(false)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer py-1 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Zurück zur Auswahl</span>
              </button>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer py-1 transition"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR-Code scannen</span>
              </button>
            </div>

            {/* Server URL */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                Kimai Server-URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://zeiterfassung.domain.de"
                className="w-full text-xs py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Die Basis-URL Ihrer Kimai-Installation (ohne /api)
              </span>
            </div>

            {/* API Password / Token (No username needed) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                  API-Passwort / Token
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
                placeholder="••••••••••••••••"
                className="w-full text-xs py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Erstellen Sie ein API-Token in Ihrem Kimai-Profil unter API-Zugriff
              </span>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full mt-2 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isProcessing ? 'Verbinde...' : 'Verbindung testen & speichern'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* PWA Tip Card */}
            <div className="mt-4 p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/40 flex items-start gap-2.5 text-xs text-sky-300">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Tipp: Sie können die App zum Startbildschirm hinzufügen (PWA), um sie wie eine native App auch offline zu nutzen.
              </span>
            </div>
          </form>
        )}
      </div>

      {/* QR Code Scanner Dialog */}
      <QRCodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleQRSuccess}
      />
    </div>
  );
};
