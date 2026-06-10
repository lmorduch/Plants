import { useRef, useState, useCallback } from 'react';
import { Camera, Upload, X, RefreshCw } from 'lucide-react';

/**
 * PhotoCapture — lets the user pick a file OR take a photo with their camera.
 * Props:
 *   onChange(file) — called with a File object when a photo is selected/captured
 *   preview — current preview URL (string) or null
 *   className — extra classes for the container
 */
export default function PhotoCapture({ onChange, preview, className = '' }) {
  const fileInputRef = useRef();
  const cameraInputRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();

  const [mode, setMode] = useState('idle'); // 'idle' | 'camera'
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // rear camera default

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      setStream(s);
      setMode('camera');
      // Attach stream to video element after render
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = s;
      }, 50);
    } catch {
      // Camera not available — fall back to file input with capture
      cameraInputRef.current?.click();
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setMode('idle');
  }

  async function flipCamera() {
    stopCamera();
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    // restart with new facing
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next },
      });
      setStream(s);
      setMode('camera');
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = s;
      }, 50);
    } catch {
      setMode('idle');
    }
  }

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onChange(file);
        stopCamera();
      },
      'image/jpeg',
      0.92
    );
  }, [onChange]);

  if (mode === 'camera') {
    return (
      <div className={`relative bg-black rounded-xl overflow-hidden ${className}`}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-4">
          <button onClick={stopCamera}
            className="bg-white/20 text-white p-3 rounded-full backdrop-blur hover:bg-white/30">
            <X size={20} />
          </button>
          <button onClick={capture}
            className="bg-white text-gray-800 p-4 rounded-full shadow-lg hover:bg-gray-100">
            <Camera size={24} />
          </button>
          <button onClick={flipCamera}
            className="bg-white/20 text-white p-3 rounded-full backdrop-blur hover:bg-white/30">
            <RefreshCw size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files[0]) onChange(e.target.files[0]); }} />
      {/* Fallback camera input for browsers that don't support getUserMedia */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { if (e.target.files[0]) onChange(e.target.files[0]); }} />
      <canvas ref={canvasRef} className="hidden" />

      {preview ? (
        <div>
          <div className="relative">
            <img src={preview} alt="Preview" className="w-full rounded-xl object-cover max-h-64" />
            <button type="button" onClick={() => onChange(null)} title="Remove"
              className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70">
              <X size={16} />
            </button>
          </div>
          <div className="flex justify-center gap-3 mt-2">
            <button type="button" onClick={startCamera}
              className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
              <Camera size={16} /> Take Photo
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              <Upload size={16} /> Upload
            </button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-green-300 rounded-xl p-6 text-center bg-green-50/50">
          <p className="text-sm text-gray-500 mb-3">Add a photo</p>
          <div className="flex justify-center gap-3">
            <button type="button" onClick={startCamera}
              className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
              <Camera size={16} /> Take Photo
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              <Upload size={16} /> Upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
