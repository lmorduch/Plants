import { useState, useRef, useEffect } from 'react';
import { chatWithAssistant } from '../api';
import { useApiKey } from '../hooks/useApiKey';
import { Link } from 'react-router-dom';
import { Bot, Send, Loader2, Key, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const STARTERS = [
  'Why are my leaves turning yellow?',
  'When should I repot?',
  'Is my watering schedule right?',
  'How do I check for pests?',
  'What fertilizer should I use?',
];

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={14} className="text-white" />
        </div>
      )}
      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-green-700 text-white rounded-tr-sm'
          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

export default function PlantAssistant({ plantId, plantName }) {
  const { hasKey } = useApiKey();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  async function send(text) {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput('');
    setError(null);

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { reply } = await chatWithAssistant(plantId, newMessages);
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      const msg = e.response?.data?.error || 'Something went wrong. Please try again.';
      const code = e.response?.data?.code;
      setError({ msg, needsKey: code === 'NO_API_KEY' });
      // Remove the user message if we failed
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-green-200 rounded-2xl overflow-hidden">
      {/* Header — toggles open/close */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-green-50 transition-colors">
        <div className="flex items-center gap-2">
          <div className="bg-green-700 rounded-lg p-1.5">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="font-semibold text-gray-800">AI Plant Assistant</span>
          <span className="text-xs text-gray-400">· Ask anything about {plantName}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* No key warning */}
          {!hasKey && (
            <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Key size={13} /> Add your Anthropic API key for the full experience.
              </span>
              <Link to="/settings" className="text-amber-700 font-semibold underline whitespace-nowrap">Settings →</Link>
            </div>
          )}

          {/* Chat messages */}
          <div className="h-72 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-gray-800 max-w-[85%]">
                    Hi! I'm your plant assistant for <strong>{plantName}</strong>. I know your care schedule and history — ask me anything! 🌿
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-9">
                  {STARTERS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => <Message key={i} msg={m} />)}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error.msg}
                {error.needsKey && (
                  <Link to="/settings" className="ml-1 font-semibold underline">Add API key →</Link>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask about watering, health, pests..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <button onClick={() => send()}
              disabled={!input.trim() || loading}
              className="bg-green-700 text-white p-2 rounded-xl hover:bg-green-800 disabled:opacity-40 transition-colors">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
