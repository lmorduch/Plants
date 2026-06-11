import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzePlant, createPlant, upsertSchedule } from '../api';
import PhotoCapture from '../components/PhotoCapture';
import { Microscope, Loader2, Leaf, CheckCircle, AlertTriangle, Plus } from 'lucide-react';

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

function SavePlantModal({ result, file, preview, onClose, onSaved }) {
  const [name, setName] = useState(result.common_name || '');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('species', result.scientific_name || '');
      fd.append('location', location.trim());
      if (result.care?.light) fd.append('sun_preference', result.care.light);
      if (result.fun_facts?.length) fd.append('fun_facts', JSON.stringify(result.fun_facts));
      if (result.history_and_origin) fd.append('history_and_origin', result.history_and_origin);
      if (result.extra_notes) fd.append('extra_notes', result.extra_notes);
      if (file) fd.append('photo', file);
      const plant = await createPlant(fd);

      // Auto-create schedules from AI data.
      const schedulePromises = [];
      const w = result.care?.watering;
      const f = result.care?.fertilizing;
      if (w?.typical_days) {
        schedulePromises.push(upsertSchedule(plant.id, 'watering', {
          interval_days: w.typical_days,
          spring_days: w.spring_days ?? null,
          summer_days: w.summer_days ?? null,
          fall_days: w.fall_days ?? null,
          winter_days: w.winter_days ?? null,
          notes: w.notes || null,
        }));
      }
      if (f?.typical_days) {
        schedulePromises.push(upsertSchedule(plant.id, 'fertilizing', {
          interval_days: f.typical_days,
          spring_days: f.spring_days ?? null,
          summer_days: f.summer_days ?? null,
          fall_days: f.fall_days ?? null,
          winter_days: f.winter_days ?? null,
          notes: f.notes || null,
        }));
      }
      await Promise.all(schedulePromises);

      onSaved(plant);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save plant.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          {preview && <img src={preview} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" alt="" />}
          <div>
            <h2 className="font-bold text-gray-900">Save as Plant</h2>
            <p className="text-sm text-gray-500">{result.scientific_name}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Location (optional)</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Kitchen windowsill"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-green-700 text-white hover:bg-green-800 disabled:opacity-40">
            {saving ? 'Saving…' : 'Save Plant'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Analyze() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('identify');
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSave, setShowSave] = useState(false);

  function handlePhoto(f) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
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
      <p className="text-gray-500 text-sm">Take a photo or upload one to identify your plant or check its health.</p>

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

      <PhotoCapture preview={preview} onChange={handlePhoto} />

      {file && (
        <button onClick={handleAnalyze} disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-green-700 text-white py-3 rounded-xl font-semibold hover:bg-green-800 disabled:opacity-60">
          {loading ? <><Loader2 size={18} className="animate-spin" /> Analyzing...</> : <><Microscope size={18} /> Analyze Photo</>}
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}

      {/* Identify results */}
      {result && mode === 'identify' && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-4">
            {preview && <img src={preview} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" alt="" />}
            <div className="flex-1 min-w-0">
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

          <button onClick={() => setShowSave(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-green-600 text-green-700 py-2.5 rounded-xl font-semibold hover:bg-green-50 transition-colors">
            <Plus size={18} /> Add to My Plants
          </button>
        </div>
      )}

      {/* Health results */}
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

      {showSave && result && mode === 'identify' && (
        <SavePlantModal
          result={result}
          file={file}
          preview={preview}
          onClose={() => setShowSave(false)}
          onSaved={(plant) => navigate(`/plants/${plant.id}`)}
        />
      )}
    </div>
  );
}
