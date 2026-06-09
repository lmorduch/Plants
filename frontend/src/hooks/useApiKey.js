import { useState } from 'react';

const KEY = 'anthropic_api_key';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem(KEY) || '');

  function setApiKey(key) {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(KEY, trimmed);
    else localStorage.removeItem(KEY);
    setApiKeyState(trimmed);
  }

  return { apiKey, setApiKey, hasKey: !!apiKey };
}

export function getStoredApiKey() {
  return localStorage.getItem(KEY) || '';
}
