import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteNote, getNotes, saveNote, updateNote } from "@/lib/tauri-commands";

export function useNotes(bookId: string | null) {
  return useQuery({
    queryKey: ["notes", bookId],
    queryFn: () => getNotes(bookId as string),
    enabled: Boolean(bookId),
  });
}

export function useSaveNote(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      body: string;
      cfi: string;
      highlightId: string | null;
      textExcerpt: string;
    }) =>
      saveNote(
        bookId as string,
        payload.highlightId,
        payload.cfi,
        payload.textExcerpt,
        payload.body,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes", bookId] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { body: string; bookId: string; id: string }) =>
      updateNote(payload.id, payload.body),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["notes", variables.bookId] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { bookId: string; id: string }) => deleteNote(payload.id),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["notes", variables.bookId] });
    },
  });
}

