import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteBook, getBooks, importBooks } from "@/lib/tauri-commands";
import type { ImportBookResult, LibraryFilter } from "@/types/book";

export function useBooks(filter: LibraryFilter) {
  return useQuery({
    queryKey: ["books", filter],
    queryFn: () => getBooks(filter),
  });
}

export function useImportBooks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filePaths: string[]) => importBooks(filePaths),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["book"] }),
      ]);
    },
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookId: string) => deleteBook(bookId),
    onSuccess: async (_, bookId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["book", bookId] }),
      ]);
    },
  });
}

export type ImportBooksMutation = ReturnType<typeof useImportBooks>;
export type ImportBooksResult = ImportBookResult;
