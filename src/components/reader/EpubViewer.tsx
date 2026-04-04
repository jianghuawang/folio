import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import {
  createEpubBridge,
  DEFAULT_READING_SETTINGS,
  getReaderErrorMessage,
  type EpubBridge,
  type ReaderHighlightActivationPayload,
  type ReaderLocationState,
  type ReaderNoteActivationPayload,
  type ReaderSelectionPayload,
  type ReaderTocItem,
} from "@/lib/epub-bridge";
import { saveReadingPosition } from "@/lib/tauri-commands";
import type { Highlight, Note } from "@/types/annotation";
import type { Book } from "@/types/book";
import type { ReadingSettings } from "@/types/settings";
import type { Translation } from "@/types/translation";

interface EpubViewerProps {
  bilingualMode: boolean;
  book: Book;
  highlights: Highlight[];
  notes: Note[];
  onBridgeReady: (bridge: EpubBridge, tocItems: ReaderTocItem[]) => void;
  onHighlightActivate: (payload: ReaderHighlightActivationPayload) => void;
  onLocationChange: (location: ReaderLocationState) => void;
  onNoteActivate: (payload: ReaderNoteActivationPayload) => void;
  onPositionRestoreError: () => void;
  onSelectionChange: (selection: ReaderSelectionPayload | null) => void;
  readingSettings: ReadingSettings;
  translations: Translation[];
}

const BACKGROUND_CLASSES: Record<ReadingSettings["theme"], string> = {
  dark: "bg-[#2c2c2e]",
  light: "bg-white",
  sepia: "bg-[#f5f0e8]",
};

export function EpubViewer({
  bilingualMode,
  book,
  highlights,
  notes,
  onBridgeReady,
  onHighlightActivate,
  onLocationChange,
  onNoteActivate,
  onPositionRestoreError,
  onSelectionChange,
  readingSettings = DEFAULT_READING_SETTINGS,
  translations,
}: EpubViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<EpubBridge | null>(null);
  const onBridgeReadyRef = useRef(onBridgeReady);
  const onHighlightActivateRef = useRef(onHighlightActivate);
  const onLocationChangeRef = useRef(onLocationChange);
  const onNoteActivateRef = useRef(onNoteActivate);
  const onPositionRestoreErrorRef = useRef(onPositionRestoreError);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const highlightsRef = useRef(highlights);
  const notesRef = useRef(notes);
  const readingSettingsRef = useRef(readingSettings);
  const translationsRef = useRef(translations);
  const bilingualModeRef = useRef(bilingualMode);
  const saveTimeoutRef = useRef<number | null>(null);
  const latestLocationRef = useRef<ReaderLocationState | null>(null);
  const lastPersistedLocationKeyRef = useRef(
    `${book.last_position_cfi ?? ""}:${book.reading_progress.toFixed(6)}`,
  );
  const closeRequestPromiseRef = useRef<Promise<void> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onBridgeReadyRef.current = onBridgeReady;
  }, [onBridgeReady]);

  useEffect(() => {
    onHighlightActivateRef.current = onHighlightActivate;
  }, [onHighlightActivate]);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onNoteActivateRef.current = onNoteActivate;
  }, [onNoteActivate]);

  useEffect(() => {
    onPositionRestoreErrorRef.current = onPositionRestoreError;
  }, [onPositionRestoreError]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    highlightsRef.current = highlights;
  }, [highlights]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    readingSettingsRef.current = readingSettings;
  }, [readingSettings]);

  useEffect(() => {
    translationsRef.current = translations;
  }, [translations]);

  useEffect(() => {
    bilingualModeRef.current = bilingualMode;
  }, [bilingualMode]);

  useEffect(() => {
    latestLocationRef.current = book.last_position_cfi
      ? {
          atEnd: false,
          atStart: false,
          cfi: book.last_position_cfi,
          chapterTitle: "",
          href: "",
          progress: book.reading_progress,
        }
      : null;
    lastPersistedLocationKeyRef.current = `${book.last_position_cfi ?? ""}:${book.reading_progress.toFixed(6)}`;
    closeRequestPromiseRef.current = null;
  }, [book.id, book.last_position_cfi, book.reading_progress]);

  const flushReadingPosition = useCallback(async () => {
    const latestLocation = latestLocationRef.current;
    if (!latestLocation?.cfi) {
      return;
    }

    const nextLocationKey = `${latestLocation.cfi}:${latestLocation.progress.toFixed(6)}`;
    if (nextLocationKey === lastPersistedLocationKeyRef.current) {
      return;
    }

    await saveReadingPosition(book.id, latestLocation.cfi, latestLocation.progress);
    lastPersistedLocationKeyRef.current = nextLocationKey;
  }, [book.id]);

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void currentWindow.onCloseRequested(async () => {
      if (!closeRequestPromiseRef.current) {
        if (saveTimeoutRef.current) {
          window.clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }

        closeRequestPromiseRef.current = flushReadingPosition().catch(() => undefined);
      }

      await closeRequestPromiseRef.current;

      if (disposed) {
        return;
      }
    }).then((registeredUnlisten) => {
      if (disposed) {
        registeredUnlisten();
        return;
      }

      unlisten = registeredUnlisten;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [flushReadingPosition]);

  useEffect(() => {
    let cancelled = false;

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    setIsLoading(true);
    setError(null);

    void createEpubBridge({
      book,
      container,
      onError: (bridgeError) => {
        if (!cancelled) {
          setError(getReaderErrorMessage(bridgeError));
          setIsLoading(false);
        }
      },
      onHighlightActivate: (payload) => {
        onHighlightActivateRef.current(payload);
      },
      onLocationChange: (location) => {
        latestLocationRef.current = location;
        onLocationChangeRef.current(location);

        if (saveTimeoutRef.current) {
          window.clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = window.setTimeout(() => {
          saveTimeoutRef.current = null;
          void flushReadingPosition().catch(() => undefined);
        }, 2000);
      },
      onNoteActivate: (note) => {
        onNoteActivateRef.current(note);
      },
      onPositionRestoreError: () => {
        onPositionRestoreErrorRef.current();
      },
      onReady: ({ bridge, toc }) => {
        if (cancelled) {
          bridge.destroy();
          return;
        }

        bridgeRef.current = bridge;
        bridge.applyReadingSettings(readingSettingsRef.current);
        bridge.setHighlights(highlightsRef.current);
        bridge.setNotes(notesRef.current);
        bridge.setTranslations({
          enabled: bilingualModeRef.current,
          targetLanguage: null,
          translations: translationsRef.current,
        });
        onBridgeReadyRef.current(bridge, toc);
        setIsLoading(false);
      },
      onSelectionChange: (selection) => {
        onSelectionChangeRef.current(selection);
      },
      readingSettings,
    }).catch((bridgeError: unknown) => {
      if (!cancelled) {
        setError(
          getReaderErrorMessage(
            bridgeError instanceof Error ? bridgeError : new Error(String(bridgeError)),
          ),
        );
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      void flushReadingPosition().catch(() => undefined);
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
  }, [book, flushReadingPosition]);

  useEffect(() => {
    bridgeRef.current?.applyReadingSettings(readingSettings);
  }, [readingSettings]);

  useEffect(() => {
    bridgeRef.current?.setHighlights(highlights);
  }, [highlights]);

  useEffect(() => {
    bridgeRef.current?.setNotes(notes);
  }, [notes]);

  useEffect(() => {
    bridgeRef.current?.setTranslations({
      enabled: bilingualMode,
      targetLanguage: null,
      translations,
    });
  }, [bilingualMode, translations]);

  return (
    <div
      className={[
        "relative h-full w-full overflow-hidden pt-[128px] pb-[52px]",
        BACKGROUND_CLASSES[readingSettings.theme],
      ].join(" ")}
    >
      <div ref={containerRef} id="epub-container" className="h-full w-full" />

      {isLoading ? (
        <div className="absolute inset-x-0 bottom-[52px] top-[128px] flex items-center justify-center bg-[inherit]">
          <div className="flex items-center gap-3 text-sm text-[--color-text-muted]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Opening book…</span>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[--color-bg-window] px-6">
          <div className="w-full max-w-md rounded-2xl border border-[--color-border-strong] bg-[--color-bg-surface] p-6 text-center shadow-popup">
            <p className="text-sm font-medium text-[--color-destructive]">Unable to open this book.</p>
            <p className="mt-2 text-sm text-[--color-text-secondary]">{error}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
