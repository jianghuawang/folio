import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getReadingSettings, updateReadingSettings } from "@/lib/tauri-commands";
import type { ReadingSettings, ReadingSettingsUpdate } from "@/types/settings";

export function useReadingSettings(bookId: string | null) {
  return useQuery({
    queryKey: ["reading-settings", bookId],
    queryFn: () => getReadingSettings(bookId as string),
    enabled: Boolean(bookId),
  });
}

export function useUpdateReadingSettings(bookId: string | null) {
  const queryClient = useQueryClient();
  const latestMutationIdRef = useRef(0);

  return useMutation({
    mutationFn: (settings: ReadingSettingsUpdate) =>
      updateReadingSettings(bookId as string, settings),
    onMutate: async (settings) => {
      const mutationId = latestMutationIdRef.current + 1;
      latestMutationIdRef.current = mutationId;

      await queryClient.cancelQueries({
        queryKey: ["reading-settings", bookId],
      });

      const previousSettings =
        queryClient.getQueryData<ReadingSettings>(["reading-settings", bookId]) ?? null;

      if (previousSettings) {
        queryClient.setQueryData<ReadingSettings>(["reading-settings", bookId], {
          ...previousSettings,
          ...settings,
        });
      }

      return {
        mutationId,
        previousSettings,
      };
    },
    onError: (_error, _settings, context) => {
      if (!context?.previousSettings || context.mutationId !== latestMutationIdRef.current) {
        return;
      }

      queryClient.setQueryData(["reading-settings", bookId], context.previousSettings);
    },
    onSuccess: (settings, _variables, context) => {
      if (context?.mutationId !== latestMutationIdRef.current) {
        return;
      }

      queryClient.setQueryData(["reading-settings", bookId], settings);
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.mutationId !== latestMutationIdRef.current) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: ["reading-settings", bookId],
      });
    },
  });
}
