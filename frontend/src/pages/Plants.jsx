import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlants, createPlant, deletePlant, upsertSchedule, markScheduleDone, analyzeByName, analyzePlant, mediaUrl } from '../api';
import { Link } from 'react-router-dom';
import { Plus, Leaf, Droplets, Trash2, X, Loader2, Sparkles, Copy, Sprout } from 'lucide-react';
import PhotoCapture from '../components/PhotoCapture';
import ImageWithFallback from '../components/ImageWithFallback';

function schedulePreview(w) {
  if (!w?.typical_days) return null;
  return `every ${w.typical_days}d${w.notes ? ` — ${w.notes}` : ''}`;
}

// Match species or common name against existing plants (case-insensitive, partial OK)
function findMatchingPlant(plants, name, species) {
  const q = (species || name || '').toLowerCase().trim();
  if (!q) return null;
  return plants.find(p =>
    (p.species && p.species.toLowerCase().includes(q)) ||
    (p.name && p.name.toLowerCase().includes(q)) ||
    q.includes((p.species || '').toLowerCase()) ||
    q.includes(p.name.toLowerCase())
  ) || null;
}

function AiDataPreview({ result }) {
  return (
    <div className="bg-green-50 rounded-xl p-3 space-y-2 text-sm">
      {result.description && <p className="text-gray-600 italic text-xs">{result.description}</p>}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {result.care?.light && (
          <div className="bg-white rounded-lg px-2 py-1.5">
            <div className="text-gray-400">☀️ Light</div>
            <div className="font-medium text-gray-700 truncate">{result.care.light}</div>
          </div>
        )}
        {result.care?.watering?.typical_days && (
          <div className="bg-white rounded-lg px-2 py-1.5">
            <div className="text-gray-400">💧 Watering</div>
            <div className="font-medium text-gray-700">every {result.care.watering.typical_days}d</div>
          </div>
        )}
        {result.care?.fertilizing?.typical_days && (
          <div className="bg-white rounded-lg px-2 py-1.5">
            <div className="text-gray-400">🌿 Fertilizing</div>
            <div className="font-medium text-gray-700">every {result.care.fertilizing.typical_days}d</div>
          </div>
        )}
        {result.pet_safe && (
          <div className={`rounded-lg px-2 py-1.5 ${result.pet_safe === 'safe' ? 'bg-green-100' : result.pet_safe === 'caution' ? 'bg-yellow-100' : 'bg-red-100'}`}>
            <div className="text-gray-400">🐾 Pets</div>
            <div className="font-medium capitalize">{result.pet_safe}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlantForm({ plants, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', species: '', location: '', acquired_date: '', notes: '' });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [aiResult, setAiResult] = useState(null);       // fetched AI data
  const [aiSource, setAiSource] = useState(null);       // 'api' | 'existing'
  const [fetchingAi, setFetchingAi] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [matchedPlant, setMatchedPlant] = useState(null); // existing plant with same species

  function handlePhoto(file) {
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
    setAiResult(null);
    setAiSource(null);
  }

  function handleNameChange(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setAiResult(null);
    setAiSource(null);

    // Check for existing plant match whenever name/species changes
    const updated = { ...form, [field]: value };
    const match = findMatchingPlant(plants, updated.name, updated.species);
    setMatchedPlant(match || null);
  }

  async function fetchAiData() {
    setFetchingAi(true);
    setAiError(null);
    setAiResult(null);
    setAiSource(null);
    try {
      let data;
      if (photo) {
        const fd = new FormData();
        fd.append('photo', photo);
        fd.append('mode', 'identify');
        data = await analyzePlant(fd);
      } else {
        data = await analyzeByName(form.species || form.name);
      }
      // Auto-fill name/species from AI if blank
      if (!form.name && data.common_name) setForm(f => ({ ...f, name: data.common_name }));
      if (!form.species && data.scientific_name) setForm(f => ({ ...f, species: data.scientific_name }));
      setAiResult(data);
      setAiSource('api');
    } catch (e) {
      setAiError(e.response?.data?.error || 'Failed to fetch AI data.');
    } finally {
      setFetchingAi(false);
    }
  }

  function useExistingPlantData() {
    if (!matchedPlant) return;
    // Build a synthetic result from the existing plant's stored data
    setAiResult({
      common_name: matchedPlant.name,
      scientific_name: matchedPlant.species,
      care: {
        light: matchedPlant.sun_preference,
        watering: matchedPlant._waterSched ? { typical_days: matchedPlant._waterSched.interval_days, notes: matchedPlant._waterSched.notes } : null,
        fertilizing: matchedPlant._fertSched ? { typical_days: matchedPlant._fertSched.interval_days, notes: matchedPlant._fertSched.notes } : null,
      },
      pet_safe: matchedPlant.pet_safe,
      pet_safety_notes: matchedPlant.pet_safety_notes,
      fun_facts: matchedPlant.fun_facts,
      history_and_origin: matchedPlant.history_and_origin,
      extra_notes: matchedPlant.extra_notes,
      _fromPlantId: matchedPlant.id,
    });
    setAiSource('existing');
  }

  const canFetchAi = !!(form.name.trim() || form.species.trim() || photo);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (photo) fd.append('photo', photo);
      if (aiResult) {
        if (aiResult.care?.light) fd.append('sun_preference', aiResult.care.light);
        if (aiResult.life_cycle) fd.append('life_cycle', aiResult.life_cycle);
        if (aiResult.fun_facts?.length) fd.append('fun_facts', JSON.stringify(aiResult.fun_facts));
        if (aiResult.history_and_origin) fd.append('history_and_origin', aiResult.history_and_origin);
        if (aiResult.extra_notes) fd.append('extra_notes', aiResult.extra_notes);
        if (aiResult.pet_safe) fd.append('pet_safe', aiResult.pet_safe);
        if (aiResult.pet_safety_notes) fd.append('pet_safety_notes', aiResult.pet_safety_notes);
      }
      const plant = await createPlant(fd);

      if (aiResult) {
        const schedulePromises = [];
        const w = aiResult.care?.watering;
        const f = aiResult.care?.fertilizing;
        if (w?.typical_days) schedulePromises.push(upsertSchedule(plant.id, 'watering', {
          interval_days: w.typical_days,
          spring_days: w.spring_days ?? null, summer_days: w.summer_days ?? null,
          fall_days: w.fall_days ?? null, winter_days: w.winter_days ?? null,
          notes: w.notes || null,
        }));
        if (f?.typical_days) schedulePromises.push(upsertSchedule(plant.id, 'fertilizing', {
          interval_days: f.typical_days,
          spring_days: f.spring_days ?? null, summer_days: f.summer_days ?? null,
          fall_days: f.fall_days ?? null, winter_days: f.winter_days ?? null,
          notes: f.notes || null,
        }));
        await Promise.all(schedulePromises);
      }
      return plant;
    },
    onSuccess: () => { qc.invalidateQueries(['plants']); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-green-900">Add New Plant</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <PhotoCapture onChange={handlePhoto} preview={photoPreview} className="mb-1" />

        <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Plant name *"
          value={form.name} onChange={e => handleNameChange('name', e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Species (optional)"
          value={form.species} onChange={e => handleNameChange('species', e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Location (e.g. Kitchen windowsill)"
          list="location-suggestions"
          value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        <datalist id="location-suggestions">
          {plants.map(p => p.location).filter((l, i, a) => l && a.indexOf(l) === i).map(l => (
            <option key={l} value={l} />
          ))}
        </datalist>

        {/* Existing plant match */}
        {matchedPlant && !aiResult && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3">
            <Copy size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-blue-800 font-medium">Looks like your {matchedPlant.name}</p>
              <p className="text-xs text-blue-600 mt-0.5">Copy its care data instead of fetching from AI?</p>
            </div>
            <button onClick={useExistingPlantData}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex-shrink-0">
              Copy
            </button>
          </div>
        )}

        {/* Fetch AI data */}
        {!aiResult && canFetchAi && !matchedPlant && (
          <button onClick={fetchAiData} disabled={fetchingAi}
            className="w-full flex items-center justify-center gap-2 border border-green-600 text-green-700 py-2 rounded-xl text-sm font-medium hover:bg-green-50 disabled:opacity-50">
            {fetchingAi ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {fetchingAi ? 'Fetching care data…' : 'Fetch AI care data'}
          </button>
        )}

        {aiError && <p className="text-xs text-red-600">{aiError}</p>}

        {/* AI result preview */}
        {aiResult && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                {aiSource === 'existing' ? <><Copy size={12} /> Copied from {matchedPlant?.name}</> : <><Sparkles size={12} /> AI care data</>}
              </p>
              <button onClick={() => { setAiResult(null); setAiSource(null); }}
                className="text-xs text-gray-400 hover:text-gray-600">Remove</button>
            </div>
            <AiDataPreview result={aiResult} />
          </div>
        )}

        <button
          onClick={() => mutate()}
          disabled={!form.name || isPending}
          className="w-full bg-green-700 text-white py-2.5 rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50">
          {isPending ? 'Adding...' : 'Add Plant'}
        </button>
      </div>
    </div>
  );
}

export default function Plants() {
  const [showForm, setShowForm] = useState(false);
  const [tapped, setTapped] = useState({}); // plantId+type -> true (optimistic feedback)
  const qc = useQueryClient();
  const { data: plants = [], isLoading } = useQuery({ queryKey: ['plants'], queryFn: getPlants });

  const { mutate: remove } = useMutation({
    mutationFn: deletePlant,
    onSuccess: () => qc.invalidateQueries(['plants']),
  });

  const { mutate: done } = useMutation({
    mutationFn: ([plantId, type]) => markScheduleDone(plantId, type),
    onSuccess: (_, [plantId, type]) => {
      setTapped(t => ({ ...t, [`${plantId}-${type}`]: true }));
      qc.invalidateQueries(['plants']);
      qc.invalidateQueries(['upcoming']);
    },
  });

  if (isLoading) return <div className="text-center py-20 text-green-700">Loading...</div>;

  // Group by location; null/empty goes last under "No room set"
  const groups = [];
  const seen = new Map();
  for (const p of plants) {
    const key = p.location?.trim() || '';
    if (!seen.has(key)) { seen.set(key, []); groups.push(key); }
    seen.get(key).push(p);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-900">My Plants ({plants.length})</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-xl hover:bg-green-800 text-sm font-medium">
          <Plus size={16} /> Add Plant
        </button>
      </div>

      {plants.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Leaf size={48} className="mx-auto mb-3 text-green-300" />
          <p className="text-lg font-medium">No plants yet!</p>
          <p className="text-sm mt-1">Tap "Add Plant" to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(room => (
            <div key={room || '__none__'}>
              {room && (
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
                  📍 {room}
                </h2>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {seen.get(room).map(p => {
                  const waterDone = tapped[`${p.id}-watering`];
                  const fertDone = tapped[`${p.id}-fertilizing`];
                  const waterOverdue = p.water_next_due && new Date(p.water_next_due) < new Date();
                  return (
                    <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow group">
                      <Link to={`/plants/${p.id}`}>
                        <div className="h-32 bg-green-100 flex items-center justify-center overflow-hidden">
                          <ImageWithFallback src={mediaUrl(p.photo_url)} alt={p.name}
                            className="w-full h-full object-cover"
                            fallback={<Leaf size={40} className="text-green-300" />} />
                        </div>
                        <div className="p-3 pb-2">
                          <div className="font-semibold text-gray-800 truncate">{p.name}</div>
                          {p.species && <div className="text-xs text-gray-400 italic truncate">{p.species}</div>}
                          {waterOverdue && !waterDone && (
                            <div className="text-xs mt-1 font-medium text-red-500">⚠️ Water overdue</div>
                          )}
                          {waterDone && (
                            <div className="text-xs mt-1 font-medium text-green-600">✓ Watered today</div>
                          )}
                        </div>
                      </Link>

                      {/* Quick-action buttons */}
                      <div className="px-3 pb-3 flex items-center gap-1.5">
                        {p.water_next_due != null && (
                          <button
                            onClick={() => done([p.id, 'watering'])}
                            disabled={waterDone}
                            title="Mark watered"
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                              waterDone
                                ? 'bg-blue-100 text-blue-400 cursor-default'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                            }`}>
                            <Droplets size={11} /> {waterDone ? 'Done' : 'Watered'}
                          </button>
                        )}
                        {p.fertilize_next_due != null && (
                          <button
                            onClick={() => done([p.id, 'fertilizing'])}
                            disabled={fertDone}
                            title="Mark fertilized"
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                              fertDone
                                ? 'bg-green-100 text-green-400 cursor-default'
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                            }`}>
                            <Sprout size={11} /> {fertDone ? 'Done' : 'Fed'}
                          </button>
                        )}
                        <button onClick={() => { if (confirm(`Delete ${p.name}?`)) remove(p.id); }}
                          className="ml-auto text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <PlantForm plants={plants} onClose={() => setShowForm(false)} />}
    </div>
  );
}
