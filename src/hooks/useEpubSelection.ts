import { useCallback, useEffect } from "react";

import type { ReaderSelectionPayload } from "@/lib/epub-bridge";
import { useReaderStore } from "@/store/readerStore";

export function useEpubSelection() {
  const selection = useReaderStore((state) => state.selection);
  const clearSelection = useReaderStore((state) => state.clearSelection);
  const setSelection = useReaderStore((state) => state.setSelection);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSelection();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;

      if (
        target?.closest("[data-folio-selection-popup='true']") ||
        target?.closest("[data-folio-note-editor='true']") ||
        target?.closest("[data-folio-quote-cover='true']")
      ) {
        return;
      }

      clearSelection();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [clearSelection]);

  const handleSelectionChange = useCallback(
    (payload: ReaderSelectionPayload | null) => {
      if (!payload) {
        clearSelection();
        return;
      }

      setSelection({
        cfiRange: payload.cfiRange,
        highlightId: null,
        position: payload.position,
        text: payload.text,
      });
    },
    [clearSelection, setSelection],
  );

  const showHighlightSelection = useCallback(
    (payload: {
      cfiRange: string;
      highlightId: string;
      position: { left: number; top: number };
      text: string;
    }) => {
      setSelection({
        ...payload,
      });
    },
    [setSelection],
  );

  return {
    clearSelection,
    handleSelectionChange,
    selection,
    showHighlightSelection,
  };
}
