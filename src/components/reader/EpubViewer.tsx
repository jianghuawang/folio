import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  createEpubBridge,
  getReaderErrorMessage,
  type EpubBridge,
  type ReaderLocationState,
  type ReaderTocItem,
} from "@/lib/epub-bridge";
import type { Book } from "@/types/book";

interface EpubViewerProps {
  book: Book;
  onBridgeReady: (bridge: EpubBridge, tocItems: ReaderTocItem[]) => void;
  onLocationChange: (location: ReaderLocationState) => void;
}

export function EpubViewer({ book, onBridgeReady, onLocationChange }: EpubViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<EpubBridge | null>(null);
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
      onLocationChange,
      onReady: ({ bridge, toc }) => {
        if (cancelled) {
          bridge.destroy();
          return;
        }

        bridgeRef.current = bridge;
        onBridgeReady(bridge, toc);
        setIsLoading(false);
      },
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
  }, [book, onBridgeReady, onLocationChange]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <div ref={containerRef} id="epub-container" className="h-full w-full" />

      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="flex items-center gap-3 text-sm text-[#6e6e73]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Opening book…</span>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white px-6">
          <div className="w-full max-w-md rounded-2xl border border-[#d1d1d6] bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-[#ff453a]">Unable to open this book.</p>
            <p className="mt-2 text-sm text-[#6e6e73]">{error}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
