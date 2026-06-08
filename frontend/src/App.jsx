import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import Plants from './pages/Plants';
import PlantDetail from './pages/PlantDetail';
import Analyze from './pages/Analyze';
import { Leaf, LayoutDashboard, Microscope, Menu, X } from 'lucide-react';
import { useState } from 'react';
import './index.css';

const queryClient = new QueryClient();

function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/plants', label: 'My Plants', icon: <Leaf size={18} /> },
    { to: '/analyze', label: 'Analyze', icon: <Microscope size={18} /> },
  ];
  return (
    <nav className="bg-green-800 text-white shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl">
          <Leaf size={24} className="text-green-300" />
          <span>PlantCare</span>
        </div>
        <div className="hidden sm:flex gap-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-green-600 text-white' : 'text-green-200 hover:bg-green-700'
                }`
              }
            >
              {l.icon}{l.label}
            </NavLink>
          ))}
        </div>
        <button className="sm:hidden" onClick={() => setOpen(o => !o)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <div className="sm:hidden px-4 pb-3 flex flex-col gap-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-green-600' : 'text-green-200 hover:bg-green-700'
                }`
              }
            >
              {l.icon}{l.label}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-green-50 flex flex-col">
          <Nav />
          <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/plants" element={<Plants />} />
              <Route path="/plants/:id" element={<PlantDetail />} />
              <Route path="/analyze" element={<Analyze />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
