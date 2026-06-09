import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlant, addLog, deleteLog, upsertSchedule, deletePlant } from '../api';
import PhotoCapture from '../components/PhotoCapture';
import PlantAssistant from '../components/PlantAssistant';
import { Droplets, Leaf, Trash2, Plus, X, FlaskConical, Scissors, Eye, ArrowLeft, Calendar, Bell, BellOff, ChevronDown, ChevronUp } from 'lucide-react';

const LOG_TYPES = ['watering', 'fertilizing', 'repotting', 'pruning', 'observation'];
const TYPE_ICONS = {
  watering: <Droplets size={14} className="text-blue-500" />,
  fertilizing: <FlaskConical size={14} className="text-yellow-500" />,
  repotting: <Leaf size={14} className="text-green-500" />,
  pruning: <Scissors size={14} className="text-gray-500" />,
  observation: <Eye size={14} className="text-purple-500" />,
};

// ── Care Plan Card ──────────────────────────────────────────────────────────
function CarePlanCard({ plantId, type, schedule, onSave }) {
  const [open, setOpen] = useState(!schedule); // open by default if no schedule
  const [days, setDays] = useState(schedule?.interval_days ?? (type === 'watering' ? 7 : 30));
  const [lastDone, setLastDone] = useState(schedule?.last_done?.split('T')[0] ?? '');
  const [notifyEnabled, setNotifyEnabled] = useState(schedule?.notify_enabled ?? true);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(schedule?.notify_days_before ?? 0);
  const [dirty, setDirty] = useState(false);

  const icon = type === 'watering'
    ? <Droplets size={18} className="text-blue-500" />
    : <FlaskConical size={18} className="text-yellow-600" />;

  function change(setter) {
    return (val) => { setter(val); setDirty(true); };
  }

  const nextDue = lastDone
    ? (() => { const d = new Date(lastDone); d.setDate(d.getDate() + Number(days)); return d; })()
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
          {schedule && (
            <span className="text-xs text-gray-500">
              every {schedule.interval_days}d
            </span>
          )}
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
            <label className="text-xs font-medium text-gray-600 block mb-1">Repeat every</label>
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

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PlantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showLog, setShowLog] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

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

  const waterSched = plant.schedules?.find(s => s.type === 'watering');
  const fertSched = plant.schedules?.find(s => s.type === 'fertilizing');

  return (
    <div className="space-y-5 pb-10">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-green-700 hover:underline text-sm">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Plant header */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="h-56 bg-green-100 flex items-center justify-center overflow-hidden">
          {plant.photo_url
            ? <img src={plant.photo_url} className="w-full h-full object-cover" alt={plant.name} />
            : <Leaf size={64} className="text-green-300" />
          }
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
            <button onClick={() => { if (confirm(`Delete ${plant.name}?`)) remove(); }}
              className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18} /></button>
          </div>
          {plant.notes && (
            <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{plant.notes}</p>
          )}
        </div>
      </div>

      {/* Care Plans */}
      <div>
        <h2 className="font-bold text-green-900 mb-3 text-lg">Care Plans</h2>
        <div className="space-y-3">
          <CarePlanCard plantId={id} type="watering" schedule={waterSched}
            onSave={(type, data) => saveSchedule([type, data])} />
          <CarePlanCard plantId={id} type="fertilizing" schedule={fertSched}
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
                  <img src={log.photo_url} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" alt="" />
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

      {/* AI Assistant */}
      <PlantAssistant plantId={id} plantName={plant.name} />

      {showLog && <AddLogModal plantId={id} onClose={() => setShowLog(false)} />}
    </div>
  );
}
