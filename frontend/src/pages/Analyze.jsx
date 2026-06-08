import { useState, useRef } from 'react';
import { analyzePlant } from '../api';
import { Microscope, Upload, Loader2, Leaf, CheckCircle, AlertTriangle } from 'lucide-react';

function HealthBar({ score }) {
  const color = score >= 8 ? 'bg-green-500' : score >= 5 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${score * 10}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-700">{score}/10</span>
    </div>
  );
}

export default function Analyze() {
  const [mode, setMode] = useState('identify');
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  }

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      fd.append('mode', mode);
      const data = await analyzePlant(fd);
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-green-900 flex items-center gap-2">
        <Microscope size={24} /> Plant Analyzer
      </h1>
      <p className="text-gray-500 text-sm">Upload a photo to identify your plant or assess its health using AI.</p>

      {/* Mode selector */}
      <div className="flex gap-2">
        {[
          { key: 'identify', label: '🌿 Identify Plant' },
          { key: 'health', label: '🏥 Health Check' },
        ].map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); setResult(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.key ? 'bg-green-700 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-green-300 rounded-2xl p-8 text-center cursor-pointer hover:bg-green-50 transition-colors"
      >
        {preview ? (
          <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-xl object-contain" />
        ) : (
          <div className="text-gray-400">
            <Upload size={40} className="mx-auto mb-2 text-green-300" />
            <p className="font-medium">Drop a photo here or click to upload</p>
            <p className="text-xs mt-1">JPG, PNG up to 10MB</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
      </div>

      {file && (
        <button onClick={handleAnalyze} disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-green-700 text-white py-3 rounded-xl font-semibold hover:bg-green-800 disabled:opacity-60">
          {loading ? <><Loader2 size={18} className="animate-spin" /> Analyzing...</> : <><Microscope size={18} /> Analyze Photo</>}
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}

      {/* Results */}
      {result && mode === 'identify' && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-4">
            {preview && <img src={preview} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" alt="" />}
            <div>
              <h2 className="text-xl font-bold text-green-900">{result.common_name}</h2>
              <p className="text-gray-500 italic text-sm">{result.scientific_name}</p>
              <p className="text-sm text-gray-600 mt-1">{result.description}</p>
            </div>
          </div>

          {result.care && (
            <div>
              <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-1.5"><Leaf size={16} />Care Tips</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['☀️ Light', result.care.light],
                  ['💧 Watering', `Every ${result.care.watering_days} days`],
                  ['🌿 Fertilizing', `Every ${result.care.fertilizing_days} days`],
                  ['💦 Humidity', result.care.humidity],
                  ['🌡️ Temperature', result.care.temperature],
                ].map(([label, value]) => value && (
                  <div key={label} className="bg-green-50 rounded-lg p-2">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="font-medium text-gray-800">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.fun_facts?.length > 0 && (
            <div>
              <h3 className="font-semibold text-green-800 mb-1">✨ Fun Facts</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {result.fun_facts.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {result && mode === 'health' && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-green-900">Health Assessment</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                result.health_score >= 8 ? 'bg-green-100 text-green-700' :
                result.health_score >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
              }`}>{result.health_status}</span>
            </div>
            <HealthBar score={result.health_score} />
          </div>

          {result.observations?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-1 flex items-center gap-1"><CheckCircle size={15} className="text-blue-500" />Observations</h3>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                {result.observations.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}

          {result.issues?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-1 flex items-center gap-1"><AlertTriangle size={15} className="text-orange-500" />Issues Detected</h3>
              <ul className="text-sm text-red-600 space-y-1 list-disc list-inside">
                {result.issues.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}

          {result.recommendations?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">💡 Recommendations</h3>
              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
