import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlants, createPlant, deletePlant, mediaUrl } from '../api';
import { Link } from 'react-router-dom';
import { Plus, Leaf, Droplets, Trash2, X } from 'lucide-react';
import PhotoCapture from '../components/PhotoCapture';

function PlantForm({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', species: '', location: '', acquired_date: '', notes: '' });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  function handlePhoto(file) {
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (photo) fd.append('photo', photo);
      return createPlant(fd);
    },
    onSuccess: () => { qc.invalidateQueries(['plants']); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-green-900">Add New Plant</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <PhotoCapture onChange={handlePhoto} preview={photoPreview} className="mb-1" />
          <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Plant name *"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Species (optional — or use Analyze to identify)"
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
        <button
          onClick={() => mutate()}
          disabled={!form.name || isPending}
          className="mt-4 w-full bg-green-700 text-white py-2.5 rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50">
          {isPending ? 'Adding...' : 'Add Plant'}
        </button>
      </div>
    </div>
  );
}

export default function Plants() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();
  const { data: plants = [], isLoading } = useQuery({ queryKey: ['plants'], queryFn: getPlants });
  const { mutate: remove } = useMutation({
    mutationFn: deletePlant,
    onSuccess: () => qc.invalidateQueries(['plants']),
  });

  if (isLoading) return <div className="text-center py-20 text-green-700">Loading...</div>;

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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {plants.map(p => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow group">
              <Link to={`/plants/${p.id}`}>
                <div className="h-36 bg-green-100 flex items-center justify-center overflow-hidden">
                  {p.photo_url
                    ? <img src={mediaUrl(p.photo_url)} className="w-full h-full object-cover" alt={p.name} />
                    : <Leaf size={40} className="text-green-300" />
                  }
                </div>
                <div className="p-3">
                  <div className="font-semibold text-gray-800 truncate">{p.name}</div>
                  {p.species && <div className="text-xs text-gray-400 italic truncate">{p.species}</div>}
                  {p.location && <div className="text-xs text-gray-500 mt-1 truncate">📍 {p.location}</div>}
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <Droplets size={12} className="text-blue-400" />
                    {p.last_watered
                      ? `${new Date(p.last_watered).toLocaleDateString()}`
                      : 'Never watered'}
                  </div>
                  {p.water_next_due && (
                    <div className={`text-xs mt-0.5 font-medium ${new Date(p.water_next_due) < new Date() ? 'text-red-500' : 'text-green-600'}`}>
                      {new Date(p.water_next_due) < new Date()
                        ? '⚠️ Watering overdue'
                        : `💧 Due ${new Date(p.water_next_due).toLocaleDateString()}`}
                    </div>
                  )}
                </div>
              </Link>
              <div className="px-3 pb-3">
                <button onClick={() => { if (confirm(`Delete ${p.name}?`)) remove(p.id); }}
                  className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <PlantForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
