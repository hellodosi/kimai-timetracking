import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed as standalone PWA, suppress
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 text-xs font-medium shadow-sm transition active:scale-95"
        title="App als PWA auf diesem Gerät installieren"
      >
        <Download className="w-3.5 h-3.5" />
        <span>App installieren</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-sky-600/40 bg-sky-950/40 text-sky-300 hover:bg-sky-900/60 px-2.5 py-1 text-xs font-medium transition"
          title="PWA auf dem Home-Bildschirm speichern"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span>iOS Installieren</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-sky-400" />
                  Als App auf iPhone / iPad installieren
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-300">
                <div className="flex items-start gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 shrink-0">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block mb-0.5">1. Teilen antippen</span>
                    Tippe in der Safari-Symbolleiste unten auf das <strong>Teilen-Symbol</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block mb-0.5">2. Zum Home-Bildschirm</span>
                    Scrolle in den Optionen nach unten und wähle <strong>"Zum Home-Bildschirm"</strong>.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-semibold text-white transition border border-slate-600"
              >
                Verstanden
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
