import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { save } from "@tauri-apps/plugin-dialog";

import {
  addHighlight,
  deleteHighlight,
  exportHighlights as exportHighlightsCommand,
  getHighlights,
  updateHighlight,
} from "@/lib/tauri-commands";
import type { HighlightColor } from "@/types/annotation";

function slugifyFileName(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : fallback;
}

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

export function useExportHighlights(bookId: string | null, bookTitle: string) {
  return useMutation({
    mutationFn: async () => {
      if (!bookId) {
        return false;
      }

      const savePath = await save({
        defaultPath: `~/Desktop/${slugifyFileName(bookTitle, "folio_book")}_highlights.md`,
        filters: [
          {
            name: "Markdown",
            extensions: ["md"],
          },
          {
            name: "CSV",
            extensions: ["csv"],
          },
        ],
        title: "Export Highlights",
      });

      if (!savePath) {
        return false;
      }

      await exportHighlightsCommand(bookId, savePath);
      return true;
    },
  });
}
