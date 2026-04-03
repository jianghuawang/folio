import { create } from "zustand";

import type { EpubBridge, ReaderLocationState } from "@/lib/epub-bridge";

export interface ReaderPopupPosition {
  left: number;
  top: number;
}

export interface ReaderSelectionState {
  cfiRange: string;
  highlightId: string | null;
  position: ReaderPopupPosition;
  text: string;
}

export interface ReaderNoteEditorState {
  cfi: string;
  highlightId: string | null;
  noteId: string | null;
  open: boolean;
  textExcerpt: string;
}

export interface ReaderQuoteCoverState {
  open: boolean;
  text: string;
}

export interface ReaderAnnotationMeta {
  chapterTitle: string;
  progress: number;
}

const DEFAULT_LOCATION: ReaderLocationState = {
  atEnd: false,
  atStart: true,
  cfi: "",
  chapterTitle: "Chapter Title",
  href: "",
  progress: 0,
};

interface ReaderStore {
  annotationMetaByKey: Record<string, ReaderAnnotationMeta>;
  annotationsOpen: boolean;
  bilingualMode: boolean;
  bridge: EpubBridge | null;
  currentLanguage: string | null;
  invalidPositionRestore: boolean;
  location: ReaderLocationState;
  noteEditor: ReaderNoteEditorState | null;
  pendingNavigationCfi: string | null;
  quoteCover: ReaderQuoteCoverState | null;
  selection: ReaderSelectionState | null;
  tocOpen: boolean;
  translationSheetOpen: boolean;
  clearAnnotationMeta: () => void;
  clearInvalidPositionRestore: () => void;
  clearPendingNavigationCfi: () => void;
  clearSelection: () => void;
  closeAnnotations: () => void;
  closeNoteEditor: () => void;
  closeQuoteCover: () => void;
  closeToc: () => void;
  closeTranslationSheet: () => void;
  openAnnotations: () => void;
  openNoteEditor: (state: Omit<ReaderNoteEditorState, "open">) => void;
  openQuoteCover: (text: string) => void;
  openToc: () => void;
  openTranslationSheet: () => void;
  requestNavigation: (cfi: string) => void;
  resetReaderState: () => void;
  setAnnotationMeta: (key: string, meta: ReaderAnnotationMeta) => void;
  setBilingualMode: (enabled: boolean) => void;
  setBridge: (bridge: EpubBridge | null) => void;
  setCurrentLanguage: (language: string | null) => void;
  setInvalidPositionRestore: (value: boolean) => void;
  setLocation: (location: ReaderLocationState) => void;
  setSelection: (selection: ReaderSelectionState | null) => void;
  toggleAnnotations: () => void;
  toggleToc: () => void;
}

export const useReaderStore = create<ReaderStore>((set) => ({
  annotationMetaByKey: {},
  annotationsOpen: false,
  bilingualMode: false,
  bridge: null,
  currentLanguage: null,
  invalidPositionRestore: false,
  location: DEFAULT_LOCATION,
  noteEditor: null,
  pendingNavigationCfi: null,
  quoteCover: null,
  selection: null,
  tocOpen: false,
  translationSheetOpen: false,
  clearAnnotationMeta: () => set({ annotationMetaByKey: {} }),
  clearInvalidPositionRestore: () => set({ invalidPositionRestore: false }),
  clearPendingNavigationCfi: () => set({ pendingNavigationCfi: null }),
  clearSelection: () => set({ selection: null }),
  closeAnnotations: () => set({ annotationsOpen: false }),
  closeNoteEditor: () => set({ noteEditor: null }),
  closeQuoteCover: () => set({ quoteCover: null }),
  closeToc: () => set({ tocOpen: false }),
  closeTranslationSheet: () => set({ translationSheetOpen: false }),
  openAnnotations: () => set({ annotationsOpen: true }),
  openNoteEditor: (state) =>
    set({
      noteEditor: {
        ...state,
        open: true,
      },
    }),
  openQuoteCover: (text) =>
    set({
      quoteCover: {
        open: true,
        text,
      },
    }),
  openToc: () => set({ tocOpen: true }),
  openTranslationSheet: () => set({ translationSheetOpen: true }),
  requestNavigation: (cfi) => set({ pendingNavigationCfi: cfi }),
  resetReaderState: () =>
    set({
      annotationMetaByKey: {},
      annotationsOpen: false,
      bilingualMode: false,
      bridge: null,
      currentLanguage: null,
      invalidPositionRestore: false,
      location: DEFAULT_LOCATION,
      noteEditor: null,
      pendingNavigationCfi: null,
      quoteCover: null,
      selection: null,
      tocOpen: false,
      translationSheetOpen: false,
    }),
  setAnnotationMeta: (key, meta) =>
    set((state) => ({
      annotationMetaByKey: {
        ...state.annotationMetaByKey,
        [key]: meta,
      },
    })),
  setBilingualMode: (enabled) => set({ bilingualMode: enabled }),
  setBridge: (bridge) => set({ bridge }),
  setCurrentLanguage: (language) => set({ currentLanguage: language }),
  setInvalidPositionRestore: (value) => set({ invalidPositionRestore: value }),
  setLocation: (location) => set({ location }),
  setSelection: (selection) => set({ selection }),
  toggleAnnotations: () =>
    set((state) => ({
      annotationsOpen: !state.annotationsOpen,
    })),
  toggleToc: () =>
    set((state) => ({
      tocOpen: !state.tocOpen,
    })),
}));

