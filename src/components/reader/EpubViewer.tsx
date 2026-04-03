import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  createEpubBridge,
  DEFAULT_READING_SETTINGS,
  getReaderErrorMessage,
  type EpubBridge,
  type ReaderLocationState,
  type ReaderSelectionPayload,
  type ReaderTocItem,
} from "@/lib/epub-bridge";
import { saveReadingPosition } from "@/lib/tauri-commands";
import type { Highlight } from "@/types/annotation";
import type { Book } from "@/types/book";
import type { ReadingSettings } from "@/types/settings";
import type { Translation } from "@/types/translation";

interface EpubViewerProps {
  bilingualMode: boolean;
  book: Book;
  highlights: Highlight[];
  onBridgeReady: (bridge: EpubBridge, tocItems: ReaderTocItem[]) => void;
  onLocationChange: (location: ReaderLocationState) => void;
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
  onBridgeReady,
  onLocationChange,
  onPositionRestoreError,
  onSelectionChange,
  readingSettings = DEFAULT_READING_SETTINGS,
  translations,
}: EpubViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<EpubBridge | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      onLocationChange: (location) => {
        onLocationChange(location);

        if (saveTimeoutRef.current) {
          window.clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = window.setTimeout(() => {
          void saveReadingPosition(book.id, location.cfi, location.progress).catch(() => undefined);
        }, 2000);
      },
      onPositionRestoreError,
      onReady: ({ bridge, toc }) => {
        if (cancelled) {
          bridge.destroy();
          return;
        }

        bridgeRef.current = bridge;
        onBridgeReady(bridge, toc);
        setIsLoading(false);
      },
      onSelectionChange,
      readingSettings,
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
  }, [
    book,
    onBridgeReady,
    onLocationChange,
    onPositionRestoreError,
    onSelectionChange,
  ]);

  useEffect(() => {
    bridgeRef.current?.applyReadingSettings(readingSettings);
  }, [readingSettings]);

  useEffect(() => {
    bridgeRef.current?.setHighlights(highlights);
  }, [highlights]);

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
