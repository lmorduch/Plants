import { useState } from 'react';
import { useApiKey } from '../hooks/useApiKey';
import { Key, Eye, EyeOff, CheckCircle, ExternalLink, Trash2 } from 'lucide-react';

export default function Settings() {
  const { hasKey, keyHint, saveKey, removeKey, isSaving } = useApiKey();
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    await saveKey(input.trim());
    setInput('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function remove() {
    await removeKey();
    setInput('');
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-green-900">Settings</h1>

      {/* API Key card */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="bg-amber-100 rounded-xl p-2 mt-0.5">
            <Key size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Anthropic API Key</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Power the AI Plant Assistant with your own Claude subscription. Your key is stored encrypted on your account, so it works across all your devices — and is never shown again after you save it.
            </p>
          </div>
        </div>

        {hasKey && (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-green-800 text-sm">
              <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
              <span className="font-mono text-xs">{keyHint}</span>
            </div>
            <button onClick={remove} className="text-red-400 hover:text-red-600 ml-2">
              <Trash2 size={15} />
            </button>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600 block">
            {hasKey ? 'Replace key' : 'Enter your API key'}
          </label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full border rounded-xl px-3 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <button onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            onClick={save}
            disabled={!input.trim() || isSaving}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              saved ? 'bg-green-100 text-green-800' :
              'bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {saved ? '✓ Saved!' : isSaving ? 'Saving...' : 'Save Key'}
          </button>
        </div>

        <div className="text-xs text-gray-400 space-y-1 pt-1 border-t border-gray-100">
          <p>Don't have a key?{' '}
            <a href="https://console.anthropic.com/account/keys" target="_blank" rel="noreferrer"
              className="text-green-600 hover:underline inline-flex items-center gap-0.5">
              Get one at console.anthropic.com <ExternalLink size={10} />
            </a>
          </p>
          <p>If no key is set here, the app falls back to the server's key (if configured by the host).</p>
        </div>
      </div>
    </div>
  );
}
