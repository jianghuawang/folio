import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getReadingSettings, updateReadingSettings } from "@/lib/tauri-commands";
import type { ReadingSettingsUpdate } from "@/types/settings";

export function useReadingSettings(bookId: string | null) {
  return useQuery({
    queryKey: ["reading-settings", bookId],
    queryFn: () => getReadingSettings(bookId as string),
    enabled: Boolean(bookId),
  });
}

export function useUpdateReadingSettings(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: ReadingSettingsUpdate) =>
      updateReadingSettings(bookId as string, settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(["reading-settings", bookId], settings);
    },
  });
}

