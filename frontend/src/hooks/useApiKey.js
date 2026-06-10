// ABOUTME: Reads and updates the user's Anthropic API key, stored encrypted on the server.
// ABOUTME: The raw key never lives on the client; only a masked hint and a hasKey flag are exposed.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiKeyInfo, saveApiKey, deleteApiKey } from '../api';

export function useApiKey() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['apiKey'], queryFn: getApiKeyInfo });

  const save = useMutation({
    mutationFn: saveApiKey,
    onSuccess: (info) => qc.setQueryData(['apiKey'], info),
  });
  const remove = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: (info) => qc.setQueryData(['apiKey'], info),
  });

  return {
    hasKey: !!data?.hasKey,
    keyHint: data?.keyHint || '',
    isLoading,
    isSaving: save.isPending,
    saveKey: save.mutateAsync,
    removeKey: remove.mutateAsync,
  };
}
