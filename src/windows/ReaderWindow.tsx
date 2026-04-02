import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { EpubViewer } from "@/components/reader/EpubViewer";
import { PageChevrons } from "@/components/reader/PageChevrons";
import { ProgressBar } from "@/components/reader/ProgressBar";
import { ReaderToolbar } from "@/components/reader/ReaderToolbar";
import { TocDrawer } from "@/components/reader/TocDrawer";
import { useBook } from "@/hooks/useBook";
import { saveReadingPosition } from "@/lib/tauri-commands";
import type {
  EpubBridge,
  ReaderLocationState,
  ReaderTocItem,
} from "@/lib/epub-bridge";

function FullScreenError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[--color-bg-window] px-6 text-[--color-text-primary]">
      <div className="w-full max-w-md rounded-2xl border border-[--color-border-strong] bg-[--color-bg-surface] p-6 text-center shadow-popup">
        <p className="text-sm font-medium text-[--color-destructive]">Unable to open reader.</p>
        <p className="mt-2 text-sm text-[--color-text-secondary]">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 text-sm text-[--color-primary] underline underline-offset-4"
          >
            Retry
          </button>
        ) : null}
      </div>
    </main>
  );
}

export default function ReaderWindow() {
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get("bookId");
  const { data: book, error, isLoading, refetch } = useBook(bookId);
  const [bridge, setBridge] = useState<EpubBridge | null>(null);
  const [tocItems, setTocItems] = useState<ReaderTocItem[]>([]);
  const [location, setLocation] = useState<ReaderLocationState>({
    atEnd: false,
    atStart: true,
    cfi: "",
    chapterTitle: "Chapter Title",
    href: "",
    progress: 0,
  });
  const [tocOpen, setTocOpen] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const toolbarTimeoutRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const showToolbar = useCallback(() => {
    setToolbarVisible(true);

    if (toolbarTimeoutRef.current) {
      window.clearTimeout(toolbarTimeoutRef.current);
    }

    toolbarTimeoutRef.current = window.setTimeout(() => {
      setToolbarVisible(false);
    }, 2000);
  }, []);

  useEffect(() => {
    showToolbar();

    return () => {
      if (toolbarTimeoutRef.current) {
        window.clearTimeout(toolbarTimeoutRef.current);
      }

      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [showToolbar]);

  useEffect(() => {
    if (!bridge) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void bridge.prev();
        showToolbar();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        void bridge.next();
        showToolbar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [bridge, showToolbar]);

  useEffect(() => {
    setBridge(null);
    setTocItems([]);
    setLocation({
      atEnd: false,
      atStart: true,
      cfi: "",
      chapterTitle: "Chapter Title",
      href: "",
      progress: 0,
    });
    setTocOpen(false);
  }, [book?.id]);

  useEffect(() => {
    if (!book || !location.cfi) {
      return undefined;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void saveReadingPosition(book.id, location.cfi, location.progress).catch(() => undefined);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [book, location.cfi, location.progress]);

  const handleBridgeReady = useCallback((readyBridge: EpubBridge, readyToc: ReaderTocItem[]) => {
    setBridge(readyBridge);
    setTocItems(readyToc);
  }, []);

  const handleLocationChange = useCallback((nextLocation: ReaderLocationState) => {
    setLocation(nextLocation);
  }, []);

  if (!bookId) {
    return <FullScreenError message="Missing required ?bookId query parameter." />;
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[--color-bg-window] px-6 text-[--color-text-primary]">
        <div className="text-sm text-[--color-text-secondary]">Opening book…</div>
      </main>
    );
  }

  if (error || !book) {
    return (
      <FullScreenError
        message={error instanceof Error ? error.message : "This book could not be loaded."}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <main
      className="flex h-screen flex-col overflow-hidden bg-[--color-bg-window] text-[--color-text-primary]"
      onMouseMove={showToolbar}
      onClick={showToolbar}
    >
      <ReaderToolbar
        title={book.title}
        visible={toolbarVisible || tocOpen}
        onToggleToc={() => {
          setTocOpen((current) => !current);
          showToolbar();
        }}
      />

      <div className="group relative flex-1 overflow-hidden">
        <EpubViewer
          book={book}
          onBridgeReady={handleBridgeReady}
          onLocationChange={handleLocationChange}
        />
        <PageChevrons
          disabled={!bridge}
          onPrev={() => {
            void bridge?.prev();
            showToolbar();
          }}
          onNext={() => {
            void bridge?.next();
            showToolbar();
          }}
        />

        <TocDrawer
          currentHref={location.href}
          items={tocItems}
          open={tocOpen}
          onOpenChange={setTocOpen}
          onSelect={(href) => {
            void bridge?.goToHref(href);
            setTocOpen(false);
            showToolbar();
          }}
        />
      </div>

      <ProgressBar chapterTitle={location.chapterTitle} progress={location.progress} />
    </main>
  );
}
