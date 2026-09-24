import React, { useState } from 'react';
import { ShieldCheck, KeyRound, ArrowRight, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StorageService } from '../services/storage';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPin = pin.trim();
    if (cleanPin.length < 4) {
      setErrorMsg('Der PIN muss mindestens 4 Zeichen lang sein.');
      return;
    }
    if (cleanPin !== confirmPin.trim()) {
      setErrorMsg('Die eingegebenen PINs stimmen nicht überein.');
      return;
    }

    setIsProcessing(true);
    try {
      await StorageService.setPin(cleanPin);
      onSuccess(cleanPin);
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Fehler beim Aktivieren des PINs.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white text-sm">PIN-Verschlüsselung (Optional)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 mt-3 leading-relaxed">
          Möchten Sie Ihre lokalen Zeiterfassungsdaten und API-Token zusätzlich mit einem persönlichen PIN schützen? 
          Alle Daten werden dann mit <strong>AES-256-GCM</strong> verschlüsselt.
        </p>

        {errorMsg && (
          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Neuer PIN</label>
              <input
                type="password"
                maxLength={10}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full text-center text-sm py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Bestätigen</label>
              <input
                type="password"
                maxLength={10}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="••••"
                className="w-full text-center text-sm py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isProcessing || !pin}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs shadow transition active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{isProcessing ? 'Verschlüssle...' : 'PIN aktivieren'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              Jetzt nicht, später einrichten
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
