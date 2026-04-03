import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAppSettings, saveAppSettings } from "@/lib/tauri-commands";
import type { AppSettings } from "@/types/settings";

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: () => getAppSettings(),
  });
}

export function useSaveAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<AppSettings>) => saveAppSettings(settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(["app-settings"], settings);
    },
  });
}

