import React, { useState } from 'react';
import { LogIn, KeyRound, Globe, QrCode, AlertCircle, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { QRCodeScannerModal } from './QRCodeScannerModal';
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
  // Login form state (Only URL & Token)
  const [url, setUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);

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

  // Handle initial login (Only URL + Token)
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
      setErrorMsg('Bitte geben Sie Ihren Kimai API-Token ein.');
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
          // If server responded with 401/403, warn user about wrong token
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 text-slate-100 my-auto">
        {/* Top Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 shadow-lg shadow-sky-500/20 text-white mb-3">
            {isPinSet ? <KeyRound className="w-7 h-7" /> : <LogIn className="w-7 h-7" />}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isPinSet ? 'App entsperren' : 'Kimai Zeiterfassung'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {isPinSet
              ? 'Geben Sie Ihren Sicherheits-PIN ein, um Ihre Zeiterfassung zu öffnen.'
              : 'Verbinden Sie Ihre Kimai-Instanz mit URL und API-Token.'}
          </p>
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
        ) : (
          /* LOGIN FORM: ONLY URL & TOKEN */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* QR Code Scan Trigger */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-sky-950/40 border border-sky-800/40">
              <div className="flex items-center gap-2 text-xs text-sky-300">
                <QrCode className="w-4 h-4 text-sky-400" />
                <span>Schnelleinrichtung via QR-Code:</span>
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                Scannen
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
                placeholder="https://kimai.ihre-domain.de"
                className="w-full text-xs py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Vollständige Webadresse Ihrer Kimai-Instanz.
              </span>
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
                placeholder="API-Token aus Ihrem Kimai-Profil"
                className="w-full text-xs py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Erstellbar in Kimai unter: Eigenes Profil → API-Zugriff.
              </span>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full mt-3 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isProcessing ? 'Verbinde...' : 'Anmelden'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
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
