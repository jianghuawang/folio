import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addHighlight,
  deleteHighlight,
  getHighlights,
  updateHighlight,
} from "@/lib/tauri-commands";
import type { HighlightColor } from "@/types/annotation";

export function useHighlights(bookId: string | null) {
  return useQuery({
    queryKey: ["highlights", bookId],
    queryFn: () => getHighlights(bookId as string),
    enabled: Boolean(bookId),
  });
}

export function useAddHighlight(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      cfiRange: string;
      color: HighlightColor;
      textExcerpt: string;
    }) => addHighlight(bookId as string, payload.cfiRange, payload.color, payload.textExcerpt),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["highlights", bookId] });
    },
  });
}

export function useUpdateHighlight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { bookId: string; color: HighlightColor; id: string }) =>
      updateHighlight(payload.id, payload.color),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["highlights", variables.bookId] });
    },
  });
}

export function useDeleteHighlight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { bookId: string; id: string }) => deleteHighlight(payload.id),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["highlights", variables.bookId] }),
        queryClient.invalidateQueries({ queryKey: ["notes", variables.bookId] }),
      ]);
    },
  });
}

