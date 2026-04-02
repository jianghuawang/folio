import { useEffect, useMemo, useState } from "react";

import { useLibraryStore } from "@/store/libraryStore";
import type { Book } from "@/types/book";

interface UseLibraryFilterInput {
  allBooks: Book[];
  recentBooks: Book[];
}

export function useLibraryFilter({ allBooks, recentBooks }: UseLibraryFilterInput) {
  const section = useLibraryStore((state) => state.section);
  const searchQuery = useLibraryStore((state) => state.searchQuery);
  const setSection = useLibraryStore((state) => state.setSection);
  const setSearchQuery = useLibraryStore((state) => state.setSearchQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const isSearchActive = normalizedQuery.length > 0;
  const baseBooks = isSearchActive ? allBooks : section === "recent" ? recentBooks : allBooks;

  const filteredBooks = useMemo(() => {
    if (!isSearchActive) {
      return baseBooks;
    }

    return allBooks.filter((book) => {
      const title = book.title.toLowerCase();
      const author = book.author.toLowerCase();

      return title.includes(normalizedQuery) || author.includes(normalizedQuery);
    });
  }, [allBooks, baseBooks, isSearchActive, normalizedQuery]);

  return {
    section,
    searchQuery,
    debouncedQuery,
    isSearchActive,
    filteredBooks,
    setSection,
    setSearchQuery,
    clearSearch: () => setSearchQuery(""),
  };
}
