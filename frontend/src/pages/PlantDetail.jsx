import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlant, addLog, deleteLog, upsertSchedule, deletePlant, updatePlant } from '../api';
import { Droplets, Leaf, Trash2, Plus, X, FlaskConical, Scissors, Eye, ArrowLeft, Calendar } from 'lucide-react';

const LOG_TYPES = ['watering', 'fertilizing', 'repotting', 'pruning', 'observation'];
const TYPE_ICONS = {
  watering: <Droplets size={14} className="text-blue-500" />,
  fertilizing: <FlaskConical size={14} className="text-yellow-500" />,
  repotting: <Leaf size={14} className="text-green-500" />,
  pruning: <Scissors size={14} className="text-gray-500" />,
  observation: <Eye size={14} className="text-purple-500" />,
};

function ScheduleCard({ plantId, type, schedule, onSave }) {
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState(schedule?.interval_days || (type === 'watering' ? 7 : 14));
  const [lastDone, setLastDone] = useState(schedule?.last_done?.split('T')[0] || '');

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-green-900 capitalize flex items-center gap-1.5">
          {type === 'watering' ? <Droplets size={16} className="text-blue-500" /> : <FlaskConical size={16} className="text-yellow-500" />}
          {type}
        </span>
        <button onClick={() => setEditing(e => !e)} className="text-xs text-green-600 hover:underline">
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>
      {schedule ? (
        <div className="text-xs text-gray-600 space-y-0.5">
          <div>Every <strong>{schedule.interval_days}</strong> days</div>
          {schedule.last_done && <div>Last: {new Date(schedule.last_done).toLocaleDateString()}</div>}
          {schedule.next_due && (
            <div className={new Date(schedule.next_due) < new Date() ? 'text-red-600 font-semibold' : 'text-green-700'}>
              Next: {new Date(schedule.next_due).toLocaleDateString()}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-400">No schedule set</div>
      )}
      {editing && (
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-xs text-gray-500">Interval (days)</label>
            <input type="number" min={1} value={days} onChange={e => setDays(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Last done</label>
            <input type="date" value={lastDone} onChange={e => setLastDone(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm mt-0.5" />
          </div>
          <button onClick={() => { onSave(type, { interval_days: days, last_done: lastDone || undefined }); setEditing(false); }}
            className="w-full bg-green-700 text-white text-xs py-1.5 rounded-lg hover:bg-green-800">
            Save Schedule
          </button>
        </div>
      )}
    </div>
  );
}

function AddLogModal({ plantId, onClose }) {
  const qc = useQueryClient();
  const [type, setType] = useState('watering');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('type', type);
      if (notes) fd.append('notes', notes);
      if (photo) fd.append('photo', photo);
      return addLog(plantId, fd);
    },
    onSuccess: () => { qc.invalidateQueries(['plant', plantId]); qc.invalidateQueries(['upcoming']); onClose(); },
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-green-900">Log Care Activity</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {LOG_TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${type === t ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t}
              </button>
            ))}
          </div>
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notes (optional)" rows={2}
            value={notes} onChange={e => setNotes(e.target.value)} />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Photo (optional)</label>
            <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])} className="text-sm" />
          </div>
        </div>
        <button onClick={() => mutate()} disabled={isPending}
          className="mt-4 w-full bg-green-700 text-white py-2 rounded-lg font-medium hover:bg-green-800 disabled:opacity-50">
          {isPending ? 'Saving...' : 'Log Activity'}
        </button>
      </div>
    </div>
  );
}

export default function PlantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showLog, setShowLog] = useState(false);
  const { data: plant, isLoading } = useQuery({ queryKey: ['plant', id], queryFn: () => getPlant(id) });
  const { mutate: removeLog } = useMutation({
    mutationFn: (logId) => deleteLog(id, logId),
    onSuccess: () => qc.invalidateQueries(['plant', id]),
  });
  const { mutate: saveSchedule } = useMutation({
    mutationFn: ([type, data]) => upsertSchedule(id, type, data),
    onSuccess: () => qc.invalidateQueries(['plant', id]),
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
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-green-700 hover:underline text-sm">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="h-52 bg-green-100 flex items-center justify-center overflow-hidden">
          {plant.photo_url
            ? <img src={plant.photo_url} className="w-full h-full object-cover" alt={plant.name} />
            : <Leaf size={64} className="text-green-300" />
          }
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-green-900">{plant.name}</h1>
              {plant.species && <p className="text-gray-500 italic">{plant.species}</p>}
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
          {plant.notes && <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{plant.notes}</p>}
        </div>
      </div>

      {/* Schedules */}
      <div>
        <h2 className="font-semibold text-green-900 mb-3">Care Schedules</h2>
        <div className="grid grid-cols-2 gap-3">
          <ScheduleCard plantId={id} type="watering" schedule={waterSched}
            onSave={(type, data) => saveSchedule([type, data])} />
          <ScheduleCard plantId={id} type="fertilizing" schedule={fertSched}
            onSave={(type, data) => saveSchedule([type, data])} />
        </div>
      </div>

      {/* Care log */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-green-900">Care Log</h2>
          <button onClick={() => setShowLog(true)}
            className="flex items-center gap-1 bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-800">
            <Plus size={14} /> Log Activity
          </button>
        </div>
        {plant.logs?.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl">
            <p className="text-sm">No care activities logged yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {plant.logs?.map(log => (
              <div key={log.id} className="bg-white rounded-xl p-3 flex gap-3 border border-gray-100 group">
                {log.photo_url && (
                  <img src={log.photo_url} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" alt="" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {TYPE_ICONS[log.type]}
                    <span className="text-sm font-medium capitalize text-gray-800">{log.type}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(log.logged_at).toLocaleDateString()}
                    </span>
                  </div>
                  {log.notes && <p className="text-xs text-gray-500 mt-0.5">{log.notes}</p>}
                </div>
                <button onClick={() => removeLog(log.id)}
                  className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLog && <AddLogModal plantId={id} onClose={() => setShowLog(false)} />}
    </div>
  );
}
