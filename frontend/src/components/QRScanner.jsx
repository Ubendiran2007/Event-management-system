import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { SwitchCamera, Loader2, CameraOff } from 'lucide-react';

// ── Error Boundary wrapper so any html5-qrcode crash doesn't break the page ──
class QRErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.error('[QRScanner] Boundary caught:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
          <CameraOff size={32} className="mx-auto text-red-400 mb-2" />
          <p className="font-semibold text-red-600 text-sm">Camera initialisation failed.</p>
          <p className="text-xs text-red-400 mt-1">Please reload the page and grant camera permission.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Inner scanner component ───────────────────────────────────────────────────
const QRScannerInner = ({ onScanSuccess, onScanError }) => {
  const [cameras, setCameras]           = useState([]);
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [isScanning, setIsScanning]     = useState(false);
  const [error, setError]               = useState(null);
  const scannerRef                      = useRef(null);
  const initLockRef                     = useRef(false);

  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onScanErrorRef.current = onScanError;
  }, [onScanSuccess, onScanError]);
  
  // Create a stable unique ID for this instance
  const readerIdRef = useRef('qr-reader-' + Math.random().toString(36).slice(2, 8));
  const READER_ID = readerIdRef.current;

  // Safe stop helper
  const safeStop = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      // Html5Qrcode.getState() === 2 means SCANNING
      if (scanner.isScanning || (scanner.getState && scanner.getState() === 2)) {
        await scanner.stop();
      }
    } catch { /* ignore */ }
    try { scanner.clear(); } catch { /* ignore */ }
    scannerRef.current = null;

    // Fallback cleanup for media tracks (delayed to prevent AbortError on play)
    setTimeout(() => {
      try {
        document.querySelectorAll('video').forEach(video => {
          if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
          }
        });
      } catch (err) {}
    }, 300);
  }, []);



  useEffect(() => {
    let isMounted = true;
    let html5QrCode = null;

    const startScanner = async () => {
      // Prevent double initialization in strict mode
      if (initLockRef.current) return;
      initLockRef.current = true;

      // Small delay to ensure DOM is ready
      await new Promise(r => setTimeout(r, 100));
      if (!isMounted) return;

      const element = document.getElementById(READER_ID);
      if (!element) return;
      element.innerHTML = ''; // Clear any previous artifacts

      console.log('[QRScanner] Scanner Initialized');

      try {
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          setError('No cameras found.');
          return;
        }

        setCameras(devices);
        const backCam = devices.find(d =>
          d.label?.toLowerCase().includes('back') ||
          d.label?.toLowerCase().includes('rear')
        );
        const selectedId = backCam ? backCam.id : devices[0].id;
        setActiveCameraId(selectedId);

        html5QrCode = new Html5Qrcode(READER_ID);
        scannerRef.current = html5QrCode;

        console.log('[QRScanner] Camera Started');
        
        await html5QrCode.start(
          selectedId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
             console.log('[QRScanner] QR Detected');
             if (onScanSuccessRef.current) onScanSuccessRef.current(decodedText); 
          },
          (errorMsg)    => { if (onScanErrorRef.current) onScanErrorRef.current(errorMsg); }
        );

        if (!isMounted) {
          // Unmounted while starting
          console.log('[QRScanner] Component unmounted during start, cleaning up...');
          try { await html5QrCode.stop(); } catch(e) {}
          try { html5QrCode.clear(); } catch(e) {}
        } else {
          setIsScanning(true);
        }
      } catch (err) {
        console.error('[QRScanner] Start error:', err);
        if (isMounted) {
          setError(
            err?.message?.toLowerCase().includes('permission')
              ? 'Camera permission denied. Please allow camera access and try again.'
              : 'Camera unavailable. Please check permissions and refresh.'
          );
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      initLockRef.current = false;
      safeStop();
    };
  }, [READER_ID, safeStop]);

  const switchCamera = async () => {
    if (cameras.length <= 1 || !scannerRef.current) return;
    const idx    = cameras.findIndex(c => c.id === activeCameraId);
    const nextId = cameras[(idx + 1) % cameras.length].id;

    await safeStop();
    
    try {
      const html5QrCode = new Html5Qrcode(READER_ID);
      scannerRef.current = html5QrCode;
      setActiveCameraId(nextId);
      await html5QrCode.start(
        nextId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { if (onScanSuccessRef.current) onScanSuccessRef.current(decodedText); },
        (errorMsg)    => { if (onScanErrorRef.current) onScanErrorRef.current(errorMsg); }
      );
      setIsScanning(true);
    } catch (err) {
      console.error('[QRScanner] Switch camera error:', err);
    }
  };

  if (error) {
    return (
      <div className="p-5 bg-red-50 border border-red-200 rounded-xl text-center">
        <CameraOff size={28} className="mx-auto text-red-400 mb-2" />
        <p className="font-semibold text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full gap-3">
      {/* The div html5-qrcode attaches to — MUST stay in DOM while scanning */}
      <div
        id={READER_ID}
        className="w-full max-w-sm rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-black"
      />

      {!isScanning && (
        <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
          <Loader2 size={16} className="animate-spin" /> Starting camera…
        </div>
      )}

      {cameras.length > 1 && isScanning && (
        <button
          type="button"
          onClick={switchCamera}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
        >
          <SwitchCamera size={16} /> Switch Camera
        </button>
      )}
    </div>
  );
};

// ── Public export — always wrapped in boundary ────────────────────────────────
const QRScanner = (props) => (
  <QRErrorBoundary>
    <QRScannerInner {...props} />
  </QRErrorBoundary>
);

export default QRScanner;
