import { create } from "zustand";

import type { LibraryFilter } from "@/types/book";

interface LibraryStore {
  section: LibraryFilter;
  searchQuery: string;
  importInProgress: boolean;
  duplicateTitles: string[];
  dropZoneVisible: boolean;
  setSection: (section: LibraryFilter) => void;
  setSearchQuery: (searchQuery: string) => void;
  setImportInProgress: (importInProgress: boolean) => void;
  setDuplicateTitles: (duplicateTitles: string[]) => void;
  clearDuplicateTitles: () => void;
  setDropZoneVisible: (dropZoneVisible: boolean) => void;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  section: "all",
  searchQuery: "",
  importInProgress: false,
  duplicateTitles: [],
  dropZoneVisible: false,
  setSection: (section) => set({ section }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setImportInProgress: (importInProgress) => set({ importInProgress }),
  setDuplicateTitles: (duplicateTitles) => set({ duplicateTitles }),
  clearDuplicateTitles: () => set({ duplicateTitles: [] }),
  setDropZoneVisible: (dropZoneVisible) => set({ dropZoneVisible }),
}));
