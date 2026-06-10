// ABOUTME: Root app component — sets up routing, auth gating, and the nav bar.
// ABOUTME: Unauthenticated users are redirected to /login before accessing any page.
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from './hooks/useAuth';
import Dashboard from './pages/Dashboard';
import Plants from './pages/Plants';
import PlantDetail from './pages/PlantDetail';
import Analyze from './pages/Analyze';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { Leaf, LayoutDashboard, Microscope, Menu, X, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useState } from 'react';
import './index.css';

const queryClient = new QueryClient();
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function Nav() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const links = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/plants', label: 'My Plants', icon: <Leaf size={18} /> },
    { to: '/analyze', label: 'Analyze', icon: <Microscope size={18} /> },
    { to: '/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
  ];
  return (
    <nav className="bg-green-800 text-white shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl">
          <Leaf size={24} className="text-green-300" />
          <span>PlantCare</span>
        </div>
        <div className="hidden sm:flex items-center gap-1">
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
          {user && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-green-600">
              {user.picture && (
                <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full" />
              )}
              <button
                onClick={logout}
                title="Sign out"
                className="flex items-center gap-1 text-green-200 hover:text-white hover:bg-green-700 px-2 py-2 rounded-lg transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
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
          {user && (
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-green-200 hover:bg-green-700 text-left"
            >
              <LogOut size={16} /> Sign out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

function AppShell() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-green-50 flex flex-col">
      {isAuthenticated && <Nav />}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/plants" element={<ProtectedRoute><Plants /></ProtectedRoute>} />
          <Route path="/plants/:id" element={<ProtectedRoute><PlantDetail /></ProtectedRoute>} />
          <Route path="/analyze" element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
