import { useNotifications } from '../hooks/useNotifications';
import { Bell, BellOff, CheckCircle, Loader2 } from 'lucide-react';

export default function NotificationBanner() {
  const { permission, subscribed, loading, supported, subscribe, unsubscribe, sendTest } = useNotifications();

  if (!supported) return null;

  if (subscribed) {
    return (
      <div className="bg-green-100 border border-green-300 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-green-800">
          <CheckCircle size={16} className="text-green-600" />
          Push notifications are <strong>on</strong> — you'll be reminded when plants need care.
        </span>
        <div className="flex gap-2">
          <button onClick={sendTest} className="text-xs text-green-600 hover:underline">Test</button>
          <button onClick={unsubscribe} disabled={loading}
            className="text-xs text-red-500 hover:underline flex items-center gap-1">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <BellOff size={12} />} Turn off
          </button>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
        🔔 Notifications are blocked. Enable them in your browser settings to get watering reminders.
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
      <span className="text-blue-800">
        <Bell size={15} className="inline mr-1.5" />
        Get reminders when your plants need watering or fertilizing.
      </span>
      <button onClick={subscribe} disabled={loading}
        className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-60">
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
        Enable
      </button>
    </div>
  );
}
