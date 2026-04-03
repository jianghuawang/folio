import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  clearApiKey,
  hasApiKey,
  saveApiKey,
  testOpenRouterConnection,
} from "@/lib/tauri-commands";

export function useApiKeyStatus() {
  return useQuery({
    queryKey: ["api-key-status"],
    queryFn: () => hasApiKey(),
  });
}

export function useSaveApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (apiKey: string) => saveApiKey(apiKey),
    onSuccess: () => {
      queryClient.setQueryData(["api-key-status"], { configured: true });
    },
  });
}

export function useClearApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearApiKey(),
    onSuccess: () => {
      queryClient.setQueryData(["api-key-status"], { configured: false });
    },
  });
}

export function useTestOpenRouterConnection() {
  return useMutation({
    mutationFn: (payload: { apiKey: string | null; model: string }) =>
      testOpenRouterConnection(payload.apiKey, payload.model),
  });
}

