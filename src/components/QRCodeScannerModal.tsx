import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, Upload, AlertCircle, RefreshCw, KeyRound, Globe } from 'lucide-react';
import type { QRConfigPayload } from '../types/kimai';

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (payload: { url: string; token: string }) => void;
}

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');

  // Stop camera when closing or changing tabs
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setScanning(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Kamera-Zugriff wird von diesem Browser nicht unterstützt.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setScanning(true);
      }
    } catch (err: unknown) {
      console.error('Camera error:', err);
      setCameraError(
        (err as Error)?.message || 'Kamera konnte nicht gestartet werden. Bitte Berechtigung prüfen.'
      );
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  // QR Code detection loop via requestAnimationFrame
  useEffect(() => {
    let animId: number;

    const scanFrame = () => {
      if (scanning && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            const success = handleDetectedString(code.data);
            if (success) {
              stopCamera();
              return;
            }
          }
        }
      }

      if (scanning) {
        animId = requestAnimationFrame(scanFrame);
      }
    };

    if (scanning) {
      animId = requestAnimationFrame(scanFrame);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [scanning]);

  // Parse QR content string
  const handleDetectedString = (rawText: string): boolean => {
    setParseError(null);
    try {
      const data: QRConfigPayload = JSON.parse(rawText);
      const url = data.url || data.baseUrl || '';
      const token = data.token || data.apiToken || '';

      if (!url || !token) {
        setParseError('QR-Code enthält kein gültiges Kimai-JSON (URL und API-Token erforderlich).');
        return false;
      }

      onScanSuccess({ url, token });
      onClose();
      return true;
    } catch {
      setParseError('Inhalt des QR-Codes ist kein gültiges JSON-Objekt.');
      return false;
    }
  };

  // Handle image upload scanning
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          handleDetectedString(code.data);
        } else {
          setParseError('Kein QR-Code im Bild erkannt. Bitte anderes Bild versuchen.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-white text-sm">Kimai QR-Code Scanner</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 text-xs">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2.5 font-medium border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'camera'
                ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Kamera
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2.5 font-medium border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'upload'
                ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Bilddatei
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2.5 font-medium border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'manual'
                ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            JSON einfügen
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {parseError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{parseError}</span>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-black border-2 border-slate-700 shadow-inner flex items-center justify-center">
                {cameraError ? (
                  <div className="p-4 text-center text-xs text-rose-300 space-y-2">
                    <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                    <p>{cameraError}</p>
                    <button
                      onClick={startCamera}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Erneut versuchen
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Viewfinder Target Overlay */}
                    <div className="absolute inset-8 border-2 border-dashed border-sky-400/80 rounded-xl pointer-events-none flex items-center justify-center">
                      <div className="w-12 h-12 border-t-2 border-l-2 border-sky-400 absolute -top-1 -left-1 rounded-tl-md"></div>
                      <div className="w-12 h-12 border-t-2 border-r-2 border-sky-400 absolute -top-1 -right-1 rounded-tr-md"></div>
                      <div className="w-12 h-12 border-b-2 border-l-2 border-sky-400 absolute -bottom-1 -left-1 rounded-bl-md"></div>
                      <div className="w-12 h-12 border-b-2 border-r-2 border-sky-400 absolute -bottom-1 -right-1 rounded-br-md"></div>
                      <span className="text-[11px] font-medium text-sky-300 bg-slate-900/80 px-2 py-0.5 rounded shadow">
                        QR-Code im Rahmen zentrieren
                      </span>
                    </div>
                  </>
                )}
              </div>

              <p className="text-center text-xs text-slate-400">
                Halten Sie den Kimai QR-Code vor die Kamera.
              </p>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-2xl cursor-pointer bg-slate-950/40 hover:bg-slate-950/80 transition">
                <div className="p-3 rounded-full bg-sky-950/60 text-sky-400 border border-sky-800/40">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-semibold text-white block">
                    QR-Code Bilddatei wählen
                  </span>
                  <span className="text-[11px] text-slate-400">PNG, JPG, WebP oder Screenshot</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                JSON-Inhalt direkt einfügen:
              </label>
              <textarea
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                placeholder='{"url": "https://kimai.ihre-domain.de", "token": "api_token_..."}'
                className="w-full h-28 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={() => handleDetectedString(pastedJson)}
                disabled={!pastedJson.trim()}
                className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer"
              >
                Konfiguration anwenden
              </button>
            </div>
          )}

          {/* Format Specification info */}
          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
            <span>Erwartetes JSON-Format im QR-Code:</span>
            <pre className="mt-1 p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-sky-300 overflow-x-auto">
{`{
  "url": "https://kimai.ihre-domain.de",
  "token": "ihr_api_token"
}`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
};
