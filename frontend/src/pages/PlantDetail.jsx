import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlant, addLog, deleteLog, upsertSchedule, deletePlant, updatePlant, analyzeByName, mediaUrl } from '../api';
import PhotoCapture from '../components/PhotoCapture';
import ImageWithFallback from '../components/ImageWithFallback';
import PlantAssistant from '../components/PlantAssistant';
import Lightbox from '../components/Lightbox';
import { Droplets, Leaf, Trash2, Plus, X, FlaskConical, Scissors, Eye, ArrowLeft, Calendar, Bell, BellOff, ChevronDown, ChevronUp, Pencil, Sun, Sparkles, PawPrint, RefreshCw, Check, Ban } from 'lucide-react';

const LOG_TYPES = ['watering', 'fertilizing', 'repotting', 'pruning', 'observation'];
const TYPE_ICONS = {
  watering: <Droplets size={14} className="text-blue-500" />,
  fertilizing: <FlaskConical size={14} className="text-yellow-500" />,
  repotting: <Leaf size={14} className="text-green-500" />,
  pruning: <Scissors size={14} className="text-gray-500" />,
  observation: <Eye size={14} className="text-purple-500" />,
};

const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const SEASON_LABELS = { spring: '🌱 Spring', summer: '☀️ Summer', fall: '🍂 Fall', winter: '❄️ Winter' };

// ── Care Plan Card ──────────────────────────────────────────────────────────
function CarePlanCard({ plantId, type, schedule, currentSeason, onSave }) {
  const [open, setOpen] = useState(!schedule);
  const effectiveDefault = schedule
    ? (currentSeason && schedule[`${currentSeason}_days`]) ?? schedule.interval_days
    : (type === 'watering' ? 7 : 30);
  const [days, setDays] = useState(effectiveDefault);
  const [lastDone, setLastDone] = useState(schedule?.last_done?.split('T')[0] ?? '');
  const [notifyEnabled, setNotifyEnabled] = useState(schedule?.notify_enabled ?? true);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(schedule?.notify_days_before ?? 0);
  const [notes, setNotes] = useState(schedule?.notes ?? '');
  const [seasonalDays, setSeasonalDays] = useState({
    spring: schedule?.spring_days ?? '',
    summer: schedule?.summer_days ?? '',
    fall: schedule?.fall_days ?? '',
    winter: schedule?.winter_days ?? '',
  });
  const [dirty, setDirty] = useState(false);

  const hasSeasonalData = SEASONS.some(s => seasonalDays[s] !== '' && seasonalDays[s] != null);
  const activeDays = hasSeasonalData && currentSeason && seasonalDays[currentSeason] !== ''
    ? seasonalDays[currentSeason]
    : days;

  const icon = type === 'watering'
    ? <Droplets size={18} className="text-blue-500" />
    : <FlaskConical size={18} className="text-yellow-600" />;

  function change(setter) {
    return (val) => { setter(val); setDirty(true); };
  }

  const nextDue = lastDone
    ? (() => { const d = new Date(lastDone); d.setDate(d.getDate() + Number(activeDays)); return d; })()
    : null;
  const isOverdue = nextDue && nextDue < new Date();

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-gray-800 capitalize">{type}</span>
          {schedule && (() => {
            const seasonVal = currentSeason && schedule[`${currentSeason}_days`];
            const hasSeasonal = SEASONS.some(s => schedule[`${s}_days`]);
            return (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                every {seasonVal ?? schedule.interval_days}d
                {hasSeasonal && (
                  <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                    currentSeason === 'spring' ? 'bg-green-100 text-green-700' :
                    currentSeason === 'summer' ? 'bg-yellow-100 text-yellow-700' :
                    currentSeason === 'fall'   ? 'bg-orange-100 text-orange-700' :
                                                 'bg-blue-100 text-blue-700'
                  }`}>
                    {SEASON_LABELS[currentSeason]}
                  </span>
                )}
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-2">
          {schedule?.next_due && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              {isOverdue ? 'Overdue' : `Due ${new Date(schedule.next_due).toLocaleDateString()}`}
            </span>
          )}
          {schedule?.notify_enabled
            ? <Bell size={14} className="text-blue-500" />
            : <BellOff size={14} className="text-gray-300" />}
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
          {/* Interval */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Default interval (days)</label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={365} value={days}
                onChange={e => change(setDays)(e.target.value)}
                className="w-20 border rounded-lg px-3 py-1.5 text-sm text-center" />
              <span className="text-sm text-gray-600">days</span>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {(type === 'watering' ? [2, 3, 5, 7, 10, 14] : [7, 14, 21, 30, 60]).map(d => (
                <button key={d} onClick={() => change(setDays)(d)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    Number(days) === d ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Seasonal intervals */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Seasonal overrides — blank = use default above</label>
            <div className="grid grid-cols-2 gap-2">
              {SEASONS.map(s => (
                <div key={s} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${s === currentSeason ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                  <span className="text-xs text-gray-500 w-16 flex-shrink-0">{SEASON_LABELS[s]}</span>
                  <input
                    type="number" min={1} max={365}
                    value={seasonalDays[s]}
                    placeholder="—"
                    onChange={e => { setSeasonalDays(sd => ({ ...sd, [s]: e.target.value })); setDirty(true); }}
                    className="w-14 text-sm text-center border-0 bg-transparent focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Care note (shown with reminders)</label>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setDirty(true); }}
              placeholder={`e.g. Water when top inch of soil is dry`}
              rows={2}
              className="w-full border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {/* Last done */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Last done</label>
            <input type="date" value={lastDone}
              onChange={e => change(setLastDone)(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="border rounded-lg px-3 py-1.5 text-sm w-full" />
            {nextDue && (
              <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600' : 'text-green-700'}`}>
                Next {type}: {nextDue.toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Notifications */}
          <div className="bg-blue-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
                <Bell size={14} /> Reminders
              </label>
              <button onClick={() => change(setNotifyEnabled)(!notifyEnabled)}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${notifyEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${notifyEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {notifyEnabled && (
              <div>
                <label className="text-xs text-blue-700 block mb-1">Notify me</label>
                <div className="flex gap-2 flex-wrap">
                  {[0, 1, 2, 3].map(d => (
                    <button key={d} onClick={() => change(setNotifyDaysBefore)(d)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        notifyDaysBefore === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50'
                      }`}>
                      {d === 0 ? 'on the day' : `${d}d before`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              onSave(type, {
                interval_days: Number(days),
                last_done: lastDone || undefined,
                notify_enabled: notifyEnabled ? 1 : 0,
                notify_days_before: notifyDaysBefore,
                notes: notes || undefined,
                spring_days: seasonalDays.spring !== '' ? Number(seasonalDays.spring) : null,
                summer_days: seasonalDays.summer !== '' ? Number(seasonalDays.summer) : null,
                fall_days: seasonalDays.fall !== '' ? Number(seasonalDays.fall) : null,
                winter_days: seasonalDays.winter !== '' ? Number(seasonalDays.winter) : null,
              });
              setDirty(false);
              setOpen(false);
            }}
            className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${
              dirty ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-gray-100 text-gray-500 cursor-default'
            }`}
          >
            {dirty ? 'Save Care Plan' : 'Saved ✓'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Add Log Modal ───────────────────────────────────────────────────────────
function AddLogModal({ plantId, onClose }) {
  const qc = useQueryClient();
  const [type, setType] = useState('watering');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  function handlePhoto(file) {
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('type', type);
      if (notes) fd.append('notes', notes);
      if (photo) fd.append('photo', photo);
      return addLog(plantId, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries(['plant', plantId]);
      qc.invalidateQueries(['upcoming']);
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-green-900">Log Care Activity</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {LOG_TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize flex items-center gap-1 ${
                  type === t ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {TYPE_ICONS[t]} {t}
              </button>
            ))}
          </div>
          <textarea className="w-full border rounded-xl px-3 py-2 text-sm resize-none" placeholder="Notes (optional)" rows={2}
            value={notes} onChange={e => setNotes(e.target.value)} />
          <PhotoCapture onChange={handlePhoto} preview={photoPreview} />
        </div>
        <button onClick={() => mutate()} disabled={isPending}
          className="mt-4 w-full bg-green-700 text-white py-2.5 rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50">
          {isPending ? 'Saving...' : 'Log Activity'}
        </button>
      </div>
    </div>
  );
}

// ── Edit Plant Modal ─────────────────────────────────────────────────────────
function EditPlantModal({ plant, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: plant.name || '',
    species: plant.species || '',
    location: plant.location || '',
    acquired_date: plant.acquired_date ? plant.acquired_date.split('T')[0] : '',
    notes: plant.notes || '',
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  function handlePhoto(file) {
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (photo) fd.append('photo', photo);
      return updatePlant(plant.id, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries(['plant', String(plant.id)]);
      qc.invalidateQueries(['plants']);
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-green-900">Edit Plant</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <PhotoCapture onChange={handlePhoto} preview={photoPreview || mediaUrl(plant.photo_url)} className="mb-1" />
          <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Plant name *"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Species (optional)"
            value={form.species} onChange={e => setForm(f => ({ ...f, species: e.target.value }))} />
          <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Location (e.g. Living room, Balcony)"
            value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date acquired</label>
            <input type="date" className="w-full border rounded-xl px-3 py-2 text-sm"
              value={form.acquired_date} onChange={e => setForm(f => ({ ...f, acquired_date: e.target.value }))} />
          </div>
          <textarea className="w-full border rounded-xl px-3 py-2 text-sm resize-none" placeholder="Notes" rows={2}
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <button onClick={() => mutate()} disabled={!form.name || isPending}
          className="mt-4 w-full bg-green-700 text-white py-2.5 rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50">
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Reanalyze Modal ──────────────────────────────────────────────────────────
function fmt(val) {
  if (!val) return '—';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function buildDiffItems(plant, result, schedules) {
  const w = result.care?.watering;
  const f = result.care?.fertilizing;
  const waterSched = schedules?.find(s => s.type === 'watering');
  const fertSched = schedules?.find(s => s.type === 'fertilizing');
  const parsedFacts = plant.fun_facts
    ? (typeof plant.fun_facts === 'string' ? JSON.parse(plant.fun_facts) : plant.fun_facts)
    : [];

  const items = [
    {
      key: 'species',
      label: 'Species',
      current: plant.species,
      suggested: result.scientific_name,
      apply: (fd) => fd.append('species', result.scientific_name || ''),
    },
    {
      key: 'sun_preference',
      label: 'Sun preference',
      current: plant.sun_preference,
      suggested: result.care?.light,
      apply: (fd) => fd.append('sun_preference', result.care?.light || ''),
    },
    {
      key: 'pet_safe',
      label: 'Pet safety',
      current: plant.pet_safe ? `${plant.pet_safe}${plant.pet_safety_notes ? ` — ${plant.pet_safety_notes}` : ''}` : null,
      suggested: result.pet_safe ? `${result.pet_safe}${result.pet_safety_notes ? ` — ${result.pet_safety_notes}` : ''}` : null,
      apply: (fd) => {
        fd.append('pet_safe', result.pet_safe || '');
        fd.append('pet_safety_notes', result.pet_safety_notes || '');
      },
    },
    {
      key: 'watering',
      label: 'Watering schedule',
      current: waterSched ? `every ${waterSched.interval_days}d${waterSched.notes ? ` — ${waterSched.notes}` : ''}` : null,
      suggested: w?.typical_days ? `every ${w.typical_days}d${w.notes ? ` — ${w.notes}` : ''}` : null,
      isSchedule: true,
      applySchedule: () => w?.typical_days ? upsertSchedule : null,
      scheduleType: 'watering',
      scheduleData: w ? { interval_days: w.typical_days, spring_days: w.spring_days ?? null, summer_days: w.summer_days ?? null, fall_days: w.fall_days ?? null, winter_days: w.winter_days ?? null, notes: w.notes || null } : null,
    },
    {
      key: 'fertilizing',
      label: 'Fertilizing schedule',
      current: fertSched ? `every ${fertSched.interval_days}d${fertSched.notes ? ` — ${fertSched.notes}` : ''}` : null,
      suggested: f?.typical_days ? `every ${f.typical_days}d${f.notes ? ` — ${f.notes}` : ''}` : null,
      isSchedule: true,
      scheduleType: 'fertilizing',
      scheduleData: f ? { interval_days: f.typical_days, spring_days: f.spring_days ?? null, summer_days: f.summer_days ?? null, fall_days: f.fall_days ?? null, winter_days: f.winter_days ?? null, notes: f.notes || null } : null,
    },
    {
      key: 'history_and_origin',
      label: 'History & origin',
      current: plant.history_and_origin,
      suggested: result.history_and_origin,
      apply: (fd) => fd.append('history_and_origin', result.history_and_origin || ''),
    },
    {
      key: 'fun_facts',
      label: 'Fun facts',
      current: parsedFacts.length ? parsedFacts.join(' • ') : null,
      suggested: result.fun_facts?.length ? result.fun_facts.join(' • ') : null,
      apply: (fd) => fd.append('fun_facts', JSON.stringify(result.fun_facts || [])),
    },
    {
      key: 'extra_notes',
      label: 'Extra notes',
      current: plant.extra_notes,
      suggested: result.extra_notes,
      apply: (fd) => fd.append('extra_notes', result.extra_notes || ''),
    },
  ];

  // Only show items that have a suggestion and differ from current
  return items.filter(item => {
    if (!item.suggested) return false;
    return fmt(item.current) !== fmt(item.suggested);
  });
}

function ReanalyzeModal({ plant, onClose }) {
  const qc = useQueryClient();
  const [step, setStep] = useState('loading'); // 'loading' | 'review' | 'saving'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [accepted, setAccepted] = useState({});

  const schedules = plant.schedules || [];
  const diffItems = result ? buildDiffItems(plant, result, schedules) : [];

  useEffect(() => {
    analyzeByName(plant.species || plant.name)
      .then(data => {
        setResult(data);
        const init = {};
        buildDiffItems(plant, data, schedules).forEach(item => { init[item.key] = true; });
        setAccepted(init);
        setStep('review');
      })
      .catch(e => {
        setError(e.response?.data?.error || 'Analysis failed.');
        setStep('review');
      });
  }, []);

  async function save() {
    setStep('saving');
    try {
      const fd = new FormData();
      // Always carry over required fields
      fd.append('name', plant.name);
      fd.append('species', plant.species || '');

      const scheduleUpdates = [];
      for (const item of diffItems) {
        if (!accepted[item.key]) continue;
        if (item.isSchedule) {
          if (item.scheduleData) scheduleUpdates.push([item.scheduleType, item.scheduleData]);
        } else {
          item.apply(fd);
        }
      }

      await updatePlant(plant.id, fd);
      await Promise.all(scheduleUpdates.map(([type, data]) => upsertSchedule(plant.id, type, data)));
      qc.invalidateQueries(['plant', String(plant.id)]);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save.');
      setStep('review');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-green-900 flex items-center gap-2">
            <RefreshCw size={18} /> Reanalyze
          </h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {step === 'loading' && (
          <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
            <RefreshCw size={18} className="animate-spin" />
            Fetching latest data for {plant.species || plant.name}…
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {step === 'review' && diffItems.length === 0 && !error && (
          <p className="text-sm text-gray-500 text-center py-8">Everything looks up to date — no changes suggested.</p>
        )}

        {step === 'review' && diffItems.length > 0 && (
          <>
            <p className="text-xs text-gray-500">{diffItems.length} suggestion{diffItems.length !== 1 ? 's' : ''} — toggle to accept or reject each.</p>
            <div className="space-y-2">
              {diffItems.map(item => (
                <div key={item.key}
                  className={`rounded-xl border p-3 transition-colors ${accepted[item.key] ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-600 mb-1">{item.label}</p>
                      {item.current && (
                        <p className="text-xs text-gray-400 line-through truncate">{fmt(item.current)}</p>
                      )}
                      <p className="text-sm text-gray-800 mt-0.5 line-clamp-3">{fmt(item.suggested)}</p>
                    </div>
                    <button
                      onClick={() => setAccepted(a => ({ ...a, [item.key]: !a[item.key] }))}
                      className={`flex-shrink-0 rounded-full p-1.5 transition-colors ${accepted[item.key] ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {accepted[item.key] ? <Check size={14} /> : <Ban size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={save} disabled={!Object.values(accepted).some(Boolean)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-green-700 text-white hover:bg-green-800 disabled:opacity-40">
                {step === 'saving' ? 'Saving…' : `Apply ${Object.values(accepted).filter(Boolean).length} change${Object.values(accepted).filter(Boolean).length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PlantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showLog, setShowLog] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showReanalyze, setShowReanalyze] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const { data: plant, isLoading } = useQuery({
    queryKey: ['plant', id],
    queryFn: () => getPlant(id),
  });

  const { mutate: removeLog } = useMutation({
    mutationFn: (logId) => deleteLog(id, logId),
    onSuccess: () => qc.invalidateQueries(['plant', id]),
  });

  const { mutate: saveSchedule } = useMutation({
    mutationFn: ([type, data]) => upsertSchedule(id, type, data),
    onSuccess: () => { qc.invalidateQueries(['plant', id]); qc.invalidateQueries(['upcoming']); },
  });

  const { mutate: remove } = useMutation({
    mutationFn: () => deletePlant(id),
    onSuccess: () => navigate('/plants'),
  });

  if (isLoading) return <div className="text-center py-20 text-green-700">Loading...</div>;
  if (!plant) return <div className="text-center py-20 text-red-500">Plant not found</div>;

  const schedules = plant.schedules || [];
  const waterSched = schedules.find(s => s.type === 'watering');
  const fertSched = schedules.find(s => s.type === 'fertilizing');

  // Derive current season client-side (northern hemisphere).
  const month = new Date().getMonth() + 1;
  const currentSeason = month >= 3 && month <= 5 ? 'spring'
    : month >= 6 && month <= 8 ? 'summer'
    : month >= 9 && month <= 11 ? 'fall'
    : 'winter';

  return (
    <div className="space-y-5 pb-10">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-green-700 hover:underline text-sm">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Plant header */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div
          className="h-56 bg-green-100 flex items-center justify-center overflow-hidden cursor-zoom-in"
          onClick={() => plant.photo_url && setLightbox(mediaUrl(plant.photo_url))}
        >
          <ImageWithFallback src={mediaUrl(plant.photo_url)} alt={plant.name}
            className="w-full h-full object-cover"
            fallback={<Leaf size={64} className="text-green-300" />} />
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-green-900">{plant.name}</h1>
              {plant.species && <p className="text-gray-500 italic text-sm">{plant.species}</p>}
              {plant.location && <p className="text-sm text-gray-500 mt-1">📍 {plant.location}</p>}
              {plant.acquired_date && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar size={12} /> Acquired {new Date(plant.acquired_date).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center">
              <button onClick={() => setShowReanalyze(true)} title="Reanalyze with AI"
                className="text-gray-400 hover:text-green-700 p-2"><RefreshCw size={18} /></button>
              <button onClick={() => setShowEdit(true)} title="Edit plant"
                className="text-gray-400 hover:text-green-700 p-2"><Pencil size={18} /></button>
              <button onClick={() => { if (confirm(`Delete ${plant.name}?`)) remove(); }}
                className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18} /></button>
            </div>
          </div>
          {plant.pet_safe && (
            <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${
              plant.pet_safe === 'safe'    ? 'bg-green-50 text-green-800' :
              plant.pet_safe === 'caution' ? 'bg-yellow-50 text-yellow-800' :
                                             'bg-red-50 text-red-800'
            }`}>
              <PawPrint size={15} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">
                  {plant.pet_safe === 'safe' ? 'Pet safe' : plant.pet_safe === 'caution' ? 'Use caution with pets' : 'Toxic to pets'}
                </span>
                {plant.pet_safety_notes && <p className="text-xs mt-0.5 opacity-80">{plant.pet_safety_notes}</p>}
              </div>
            </div>
          )}

          {plant.notes && (
            <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{plant.notes}</p>
          )}

          {plant.sun_preference && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              <Sun size={15} className="flex-shrink-0" />
              <span>{plant.sun_preference}</span>
            </div>
          )}

          {plant.fun_facts?.length > 0 && (
            <div className="mt-3 bg-green-50 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-green-800 flex items-center gap-1.5 mb-2">
                <Sparkles size={13} /> Fun Facts
              </p>
              <ul className="space-y-1">
                {(typeof plant.fun_facts === 'string' ? JSON.parse(plant.fun_facts) : plant.fun_facts).map((f, i) => (
                  <li key={i} className="text-sm text-green-900 flex gap-2">
                    <span className="text-green-400 flex-shrink-0">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Care Plans */}
      <div>
        <h2 className="font-bold text-green-900 mb-3 text-lg">Care Plans</h2>
        <div className="space-y-3">
          <CarePlanCard plantId={id} type="watering" schedule={waterSched} currentSeason={currentSeason}
            onSave={(type, data) => saveSchedule([type, data])} />
          <CarePlanCard plantId={id} type="fertilizing" schedule={fertSched} currentSeason={currentSeason}
            onSave={(type, data) => saveSchedule([type, data])} />
        </div>
      </div>

      {/* Care Log */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-green-900 text-lg">Care Log</h2>
          <button onClick={() => setShowLog(true)}
            className="flex items-center gap-1.5 bg-green-700 text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-green-800">
            <Plus size={14} /> Log Activity
          </button>
        </div>

        {!plant.logs?.length ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl">
            <p className="text-sm">No activities logged yet.</p>
            <button onClick={() => setShowLog(true)}
              className="mt-2 text-green-600 text-sm underline">Log the first one</button>
          </div>
        ) : (
          <div className="space-y-2">
            {plant.logs.map(log => (
              <div key={log.id} className="bg-white rounded-xl p-3 flex gap-3 border border-gray-100 group items-start">
                {log.photo_url && (
                  <ImageWithFallback src={mediaUrl(log.photo_url)} alt=""
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0 cursor-zoom-in"
                    onClick={() => setLightbox(mediaUrl(log.photo_url))}
                    fallback={<div className="w-16 h-16 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0"><Leaf size={24} className="text-green-300" /></div>} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {TYPE_ICONS[log.type]}
                    <span className="text-sm font-semibold capitalize text-gray-800">{log.type}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(log.logged_at).toLocaleDateString()}
                    </span>
                  </div>
                  {log.notes && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{log.notes}</p>}
                </div>
                <button onClick={() => removeLog(log.id)}
                  className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extra Notes */}
      {plant.extra_notes && (
        <div className="bg-amber-50 rounded-2xl p-5">
          <h2 className="font-bold text-amber-900 text-lg mb-2">Care Notes</h2>
          <p className="text-sm text-amber-800 leading-relaxed">{plant.extra_notes}</p>
        </div>
      )}

      {/* History & Origin */}
      {plant.history_and_origin && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-green-900 text-lg mb-2">History &amp; Origin</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{plant.history_and_origin}</p>
        </div>
      )}

      {/* AI Assistant */}
      <PlantAssistant plantId={id} plantName={plant.name} />

      {showLog && <AddLogModal plantId={id} onClose={() => setShowLog(false)} />}
      {showEdit && <EditPlantModal plant={plant} onClose={() => setShowEdit(false)} />}
      {showReanalyze && <ReanalyzeModal plant={plant} onClose={() => setShowReanalyze(false)} />}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
