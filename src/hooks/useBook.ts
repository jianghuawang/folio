import { useQuery } from "@tanstack/react-query";

import { getBook } from "@/lib/tauri-commands";

export function useBook(bookId: string | null) {
  return useQuery({
    queryKey: ["book", bookId],
    queryFn: () => getBook(bookId as string),
    enabled: Boolean(bookId),
  });
}
