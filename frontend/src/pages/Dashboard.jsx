import { useQuery } from '@tanstack/react-query';
import { getPlants, getUpcoming } from '../api';
import { Link } from 'react-router-dom';
import { Droplets, Sprout, AlertTriangle, CheckCircle, Leaf } from 'lucide-react';

function DaysChip({ days }) {
  if (days === null || days === undefined) return <span className="text-gray-400 text-xs">No schedule</span>;
  const d = Math.ceil((new Date(days) - new Date()) / 86400000);
  if (d < 0) return <span className="text-red-600 text-xs font-semibold flex items-center gap-1"><AlertTriangle size={12} />Overdue {Math.abs(d)}d</span>;
  if (d === 0) return <span className="text-orange-500 text-xs font-semibold">Due today</span>;
  return <span className="text-green-700 text-xs">In {d}d</span>;
}

export default function Dashboard() {
  const { data: plants = [], isLoading } = useQuery({ queryKey: ['plants'], queryFn: getPlants });
  const { data: upcoming = [] } = useQuery({ queryKey: ['upcoming'], queryFn: () => getUpcoming(7) });

  const overdue = upcoming.filter(u => new Date(u.next_due) < new Date());

  if (isLoading) return <div className="text-center py-20 text-green-700">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-green-900">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Plants', value: plants.length, icon: <Leaf className="text-green-500" size={22} />, bg: 'bg-green-100' },
          { label: 'Tasks This Week', value: upcoming.length, icon: <Droplets className="text-blue-500" size={22} />, bg: 'bg-blue-100' },
          { label: 'Overdue', value: overdue.length, icon: <AlertTriangle className="text-red-500" size={22} />, bg: 'bg-red-100' },
          { label: 'Up to Date', value: plants.length - overdue.filter((v,i,a)=>a.findIndex(t=>t.plant_id===v.plant_id)===i).length, icon: <CheckCircle className="text-emerald-500" size={22} />, bg: 'bg-emerald-100' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
            {s.icon}
            <div>
              <div className="text-2xl font-bold text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming care */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
            <Droplets size={18} className="text-blue-500" /> Upcoming Care (7 days)
          </h2>
          <div className="space-y-2">
            {upcoming.map(u => (
              <Link key={`${u.plant_id}-${u.type}`} to={`/plants/${u.plant_id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-green-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  {u.photo_url
                    ? <img src={u.photo_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                    : <div className="w-9 h-9 rounded-full bg-green-200 flex items-center justify-center"><Leaf size={16} className="text-green-700" /></div>
                  }
                  <div>
                    <div className="font-medium text-sm text-gray-800">{u.plant_name}</div>
                    <div className="text-xs text-gray-500 capitalize">{u.type}</div>
                  </div>
                </div>
                <DaysChip days={u.next_due} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Plant list preview */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-green-900">Your Plants</h2>
          <Link to="/plants" className="text-green-600 text-sm hover:underline">View all →</Link>
        </div>
        {plants.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Sprout size={40} className="mx-auto mb-2" />
            <p>No plants yet. <Link to="/plants" className="text-green-600 underline">Add your first plant!</Link></p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {plants.slice(0, 6).map(p => (
              <Link key={p.id} to={`/plants/${p.id}`}
                className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-28 bg-green-100 flex items-center justify-center overflow-hidden">
                  {p.photo_url
                    ? <img src={p.photo_url} className="w-full h-full object-cover" alt={p.name} />
                    : <Leaf size={36} className="text-green-400" />
                  }
                </div>
                <div className="p-2">
                  <div className="font-medium text-sm text-gray-800 truncate">{p.name}</div>
                  {p.species && <div className="text-xs text-gray-400 italic truncate">{p.species}</div>}
                  <div className="mt-1 flex gap-1 flex-wrap">
                    <span className="text-xs flex items-center gap-0.5"><Droplets size={10} className="text-blue-400" /><DaysChip days={p.water_next_due} /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
