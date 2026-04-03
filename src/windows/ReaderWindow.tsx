import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AnnotationsDrawer } from "@/components/reader/AnnotationsDrawer";
import { EpubViewer } from "@/components/reader/EpubViewer";
import { NoteEditor } from "@/components/reader/NoteEditor";
import { PageChevrons } from "@/components/reader/PageChevrons";
import { ProgressBar } from "@/components/reader/ProgressBar";
import { QuoteCoverModal } from "@/components/reader/QuoteCoverModal";
import { ReaderToolbar } from "@/components/reader/ReaderToolbar";
import { SelectionPopup } from "@/components/reader/SelectionPopup";
import { TocDrawer } from "@/components/reader/TocDrawer";
import { TranslationBanner } from "@/components/reader/TranslationBanner";
import { TranslationSheet } from "@/components/reader/TranslationSheet";
import { useApiKeyStatus } from "@/hooks/useApiKeyStatus";
import { useBook } from "@/hooks/useBook";
import { useEpubSelection } from "@/hooks/useEpubSelection";
import {
  useAddHighlight,
  useDeleteHighlight,
  useHighlights,
  useUpdateHighlight,
} from "@/hooks/useHighlights";
import { useDeleteNote, useNotes, useSaveNote, useUpdateNote } from "@/hooks/useNotes";
import {
  useReadingSettings,
  useUpdateReadingSettings,
} from "@/hooks/useReadingSettings";
import { useTranslation } from "@/hooks/useTranslation";
import { useWindowState } from "@/hooks/useWindowState";
import type { Highlight } from "@/types/annotation";
import type {
  EpubBridge,
  ReaderLocationState,
  ReaderTocItem,
} from "@/lib/epub-bridge";
import { useReaderStore } from "@/store/readerStore";

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

function nextTheme(currentTheme: "dark" | "light" | "sepia") {
  if (currentTheme === "light") {
    return "sepia";
  }

  if (currentTheme === "sepia") {
    return "dark";
  }

  return "light";
}

function getHighlightStartCfi(highlight: Highlight) {
  const [startFragment] = highlight.cfi_range.split(",");
  return startFragment.endsWith(")") ? startFragment : highlight.cfi_range;
}

export default function ReaderWindow() {
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get("bookId");
  const { data: book, error, isLoading, refetch } = useBook(bookId);
  const readingSettingsQuery = useReadingSettings(bookId);
  const updateReadingSettingsMutation = useUpdateReadingSettings(bookId);
  const highlightsQuery = useHighlights(bookId);
  const addHighlightMutation = useAddHighlight(bookId);
  const updateHighlightMutation = useUpdateHighlight();
  const deleteHighlightMutation = useDeleteHighlight();
  const notesQuery = useNotes(bookId);
  const saveNoteMutation = useSaveNote(bookId);
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();
  const apiKeyStatusQuery = useApiKeyStatus();
  const selectionController = useEpubSelection();
  const translation = useTranslation(bookId, book?.title ?? "Book");
  const { isFocused } = useWindowState();

  const bridge = useReaderStore((state) => state.bridge);
  const closeAnnotations = useReaderStore((state) => state.closeAnnotations);
  const closeNoteEditor = useReaderStore((state) => state.closeNoteEditor);
  const closeQuoteCover = useReaderStore((state) => state.closeQuoteCover);
  const closeTranslationSheet = useReaderStore((state) => state.closeTranslationSheet);
  const invalidPositionRestore = useReaderStore((state) => state.invalidPositionRestore);
  const noteEditor = useReaderStore((state) => state.noteEditor);
  const openNoteEditor = useReaderStore((state) => state.openNoteEditor);
  const quoteCover = useReaderStore((state) => state.quoteCover);
  const resetReaderState = useReaderStore((state) => state.resetReaderState);
  const selection = useReaderStore((state) => state.selection);
  const setAnnotationMeta = useReaderStore((state) => state.setAnnotationMeta);
  const clearAnnotationMeta = useReaderStore((state) => state.clearAnnotationMeta);
  const setBridge = useReaderStore((state) => state.setBridge);
  const setInvalidPositionRestore = useReaderStore((state) => state.setInvalidPositionRestore);
  const location = useReaderStore((state) => state.location);
  const setLocation = useReaderStore((state) => state.setLocation);
  const tocOpen = useReaderStore((state) => state.tocOpen);
  const toggleToc = useReaderStore((state) => state.toggleToc);
  const annotationsOpen = useReaderStore((state) => state.annotationsOpen);
  const toggleAnnotations = useReaderStore((state) => state.toggleAnnotations);
  const translationSheetOpen = useReaderStore((state) => state.translationSheetOpen);
  const openTranslationSheet = useReaderStore((state) => state.openTranslationSheet);

  const [tocItems, setTocItems] = useState<ReaderTocItem[]>([]);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const toolbarTimeoutRef = useRef<number | null>(null);
  const lastTranslationErrorRef = useRef<string | null>(null);

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
    };
  }, [showToolbar]);

  useEffect(() => {
    if (isFocused) {
      showToolbar();
    }
  }, [isFocused, showToolbar]);

  useEffect(() => {
    resetReaderState();
    setTocItems([]);
  }, [book?.id, resetReaderState]);

  useEffect(() => {
    if (!translation.latestError) {
      return;
    }

    const errorKey = [
      translation.latestError.job_id,
      translation.latestError.spine_item_href,
      translation.latestError.paragraph_index,
      translation.latestError.error_message,
    ].join(":");

    if (lastTranslationErrorRef.current === errorKey) {
      return;
    }

    lastTranslationErrorRef.current = errorKey;

    if (translation.latestError.error_message === "Invalid API key.") {
      window.alert("Translation failed: Invalid API key. Please check your API key in Settings.");
    }
  }, [translation.latestError]);

  useEffect(() => {
    if (!bridge) {
      clearAnnotationMeta();
      return;
    }

    const items = [
      ...(highlightsQuery.data ?? []).map((highlight) => ({
        cfi: getHighlightStartCfi(highlight),
        key: `highlight:${highlight.id}`,
      })),
      ...(notesQuery.data ?? []).map((note) => ({
        cfi: note.cfi,
        key: `note:${note.id}`,
      })),
    ];

    let cancelled = false;

    const resolveAnnotationMeta = async () => {
      for (const item of items) {
        const resolved = await bridge.resolveAnnotationLocation(item.cfi);
        if (!cancelled && resolved) {
          setAnnotationMeta(item.key, resolved);
        }
      }
    };

    void resolveAnnotationMeta();

    return () => {
      cancelled = true;
    };
  }, [
    bridge,
    clearAnnotationMeta,
    highlightsQuery.data,
    notesQuery.data,
    setAnnotationMeta,
  ]);

  const handleBridgeReady = useCallback((readyBridge: EpubBridge, readyToc: ReaderTocItem[]) => {
    setBridge(readyBridge);
    setTocItems(readyToc);
  }, [setBridge]);

  const handleLocationChange = useCallback((nextLocation: ReaderLocationState) => {
    setLocation(nextLocation);
  }, [setLocation]);

  const handlePositionRestoreError = useCallback(() => {
    setInvalidPositionRestore(true);
  }, [setInvalidPositionRestore]);

  const currentReadingSettings = readingSettingsQuery.data;
  const highlightItems = useMemo(
    () =>
      (highlightsQuery.data ?? []).map((highlight) => ({
        highlight,
        meta: useReaderStore.getState().annotationMetaByKey[`highlight:${highlight.id}`] ?? null,
      })),
    [highlightsQuery.data],
  );
  const noteItems = useMemo(
    () =>
      (notesQuery.data ?? []).map((note) => ({
        meta: useReaderStore.getState().annotationMetaByKey[`note:${note.id}`] ?? null,
        note,
      })),
    [notesQuery.data],
  );

  const activeHighlight = useMemo(() => {
    if (!selection?.highlightId) {
      return null;
    }

    return (highlightsQuery.data ?? []).find((highlight) => highlight.id === selection.highlightId) ?? null;
  }, [highlightsQuery.data, selection?.highlightId]);

  const activeNote = useMemo(() => {
    if (!noteEditor) {
      return null;
    }

    return (notesQuery.data ?? []).find((note) => note.id === noteEditor.noteId) ?? null;
  }, [noteEditor, notesQuery.data]);

  const handleColorSelect = async (color: Highlight["color"]) => {
    if (!bookId || !selection) {
      return;
    }

    try {
      if (selection.highlightId) {
        await updateHighlightMutation.mutateAsync({
          bookId,
          color,
          id: selection.highlightId,
        });
        return;
      }

      const highlight = await addHighlightMutation.mutateAsync({
        cfiRange: selection.cfiRange,
        color,
        textExcerpt: selection.text,
      });

      selectionController.showHighlightSelection({
        cfiRange: selection.cfiRange,
        highlightId: highlight.id,
        position: selection.position,
        text: selection.text,
      });
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "An error occurred saving your data. Your changes may not be saved.";
      window.alert(message);
    }
  };

  const handleOpenNoteEditor = () => {
    if (!selection) {
      return;
    }

    const existingNote =
      selection.highlightId
        ? (notesQuery.data ?? []).find((note) => note.highlight_id === selection.highlightId)
        : null;

    openNoteEditor({
      cfi: selection.cfiRange,
      highlightId: selection.highlightId,
      noteId: existingNote?.id ?? null,
      textExcerpt: selection.text,
    });
  };

  const handleSaveNote = async (body: string) => {
    if (!bookId || !noteEditor) {
      return;
    }

    try {
      if (noteEditor.noteId) {
        await updateNoteMutation.mutateAsync({
          body,
          bookId,
          id: noteEditor.noteId,
        });
      } else {
        await saveNoteMutation.mutateAsync({
          body,
          cfi: noteEditor.cfi,
          highlightId: noteEditor.highlightId,
          textExcerpt: noteEditor.textExcerpt,
        });
      }

      closeNoteEditor();
      selectionController.clearSelection();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "An error occurred saving your data. Your changes may not be saved.";
      window.alert(message);
    }
  };

  const handleDeleteNote = async () => {
    if (!bookId || !noteEditor?.noteId) {
      return;
    }

    const confirmed = window.confirm("Delete this note?");
    if (!confirmed) {
      return;
    }

    await deleteNoteMutation.mutateAsync({
      bookId,
      id: noteEditor.noteId,
    });
    closeNoteEditor();
  };

  const handleJumpToHighlight = (highlight: Highlight) => {
    void bridge?.goToCfi(getHighlightStartCfi(highlight));
    closeAnnotations();
    showToolbar();
  };

  const handleJumpToNote = (note: NonNullable<(typeof notesQuery.data)>[number]) => {
    void bridge?.goToCfi(note.cfi);
    closeAnnotations();
    showToolbar();
  };

  const handleDeleteHighlight = (highlightId: string) => {
    if (!bookId) {
      return;
    }

    const confirmed = window.confirm("Delete this highlight?");
    if (!confirmed) {
      return;
    }

    void deleteHighlightMutation.mutateAsync({
      bookId,
      id: highlightId,
    });
  };

  const handleDeleteDrawerNote = (noteId: string) => {
    if (!bookId) {
      return;
    }

    const confirmed = window.confirm("Delete this note?");
    if (!confirmed) {
      return;
    }

    void deleteNoteMutation.mutateAsync({
      bookId,
      id: noteId,
    });
  };

  if (!bookId) {
    return <FullScreenError message="Missing required ?bookId query parameter." />;
  }

  if (isLoading || readingSettingsQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[--color-bg-window] px-6 text-[--color-text-primary]">
        <div className="text-sm text-[--color-text-secondary]">Opening book…</div>
      </main>
    );
  }

  if (error || !book || readingSettingsQuery.error || !currentReadingSettings) {
    return (
      <FullScreenError
        message={
          error instanceof Error
            ? error.message
            : readingSettingsQuery.error instanceof Error
              ? readingSettingsQuery.error.message
              : "This book could not be loaded."
        }
        onRetry={() => {
          void refetch();
          void readingSettingsQuery.refetch();
        }}
      />
    );
  }

  return (
    <main
      className="h-screen overflow-hidden bg-[--color-bg-window] text-[--color-text-primary]"
      onClick={showToolbar}
      onMouseMove={showToolbar}
    >
      <div className="group relative h-full w-full overflow-hidden">
        <EpubViewer
          bilingualMode={translation.bilingualMode}
          book={book}
          highlights={highlightsQuery.data ?? []}
          onBridgeReady={handleBridgeReady}
          onLocationChange={handleLocationChange}
          onPositionRestoreError={handlePositionRestoreError}
          onSelectionChange={selectionController.handleSelectionChange}
          readingSettings={currentReadingSettings}
          translations={translation.translations}
        />

        <ReaderToolbar
          canExport={translation.canExport}
          canTranslate={apiKeyStatusQuery.data?.configured ?? false}
          onCycleTheme={() =>
            void updateReadingSettingsMutation.mutateAsync({
              theme: nextTheme(currentReadingSettings.theme),
            })
          }
          onExport={() => void translation.exportMutation.mutateAsync()}
          onOpenTranslationSheet={openTranslationSheet}
          onToggleAnnotations={toggleAnnotations}
          onToggleBilingualMode={() => translation.setBilingualMode(!translation.bilingualMode)}
          onToggleToc={toggleToc}
          onUpdateReadingSettings={(payload) => void updateReadingSettingsMutation.mutateAsync(payload)}
          readingSettings={currentReadingSettings}
          showBilingualToggle={Boolean(translation.currentLanguage)}
          title={book.title}
          visible={toolbarVisible || tocOpen || annotationsOpen}
        />

        <TranslationBanner
          bookTitle={book.title}
          exportProgress={translation.exportProgress}
          job={translation.job}
          onCancel={() => void translation.cancelMutation.mutateAsync()}
          onPause={() => void translation.pauseMutation.mutateAsync()}
          onResume={() => void translation.resumeMutation.mutateAsync()}
          onRetryFailed={() => void translation.retryMutation.mutateAsync()}
          statusMessage={translation.statusMessage}
        />

        {invalidPositionRestore ? (
          <div className="absolute inset-x-0 top-16 z-30 flex justify-center px-6">
            <div className="rounded-full bg-[--color-bg-surface] px-4 py-2 text-sm text-[--color-text-secondary] shadow-popup">
              Your reading position could not be restored.
            </div>
          </div>
        ) : null}

        <PageChevrons
          disabled={!bridge}
          visible={toolbarVisible}
          onPrev={() => {
            void bridge?.prev();
            showToolbar();
          }}
          onNext={() => {
            void bridge?.next();
            showToolbar();
          }}
        />

        <ProgressBar chapterTitle={location.chapterTitle} progress={location.progress} />

        <TocDrawer
          currentHref={location.href}
          items={tocItems}
          open={tocOpen}
          onOpenChange={(open) => {
            if (open) {
              toggleToc();
            } else {
              useReaderStore.getState().closeToc();
            }
          }}
          onSelect={(href) => {
            void bridge?.goToHref(href);
            useReaderStore.getState().closeToc();
            showToolbar();
          }}
        />

        <SelectionPopup
          activeColor={activeHighlight?.color ?? null}
          onColorSelect={handleColorSelect}
          onOpenNote={handleOpenNoteEditor}
          onOpenQuote={() => {
            if (selection) {
              useReaderStore.getState().openQuoteCover(selection.text);
            }
          }}
          position={selection?.position ?? { left: 0, top: 0 }}
          visible={Boolean(selection)}
        />

        {noteEditor ? (
          <NoteEditor
            initialBody={activeNote?.body ?? ""}
            onCancel={closeNoteEditor}
            onDelete={activeNote ? handleDeleteNote : undefined}
            onSave={handleSaveNote}
            textExcerpt={noteEditor.textExcerpt}
          />
        ) : null}

        <AnnotationsDrawer
          highlightError={Boolean(highlightsQuery.error)}
          highlightItems={highlightItems}
          highlightsLoading={highlightsQuery.isLoading}
          noteError={Boolean(notesQuery.error)}
          noteItems={noteItems}
          notesLoading={notesQuery.isLoading}
          onDeleteHighlight={handleDeleteHighlight}
          onDeleteNote={handleDeleteDrawerNote}
          onJumpToHighlight={handleJumpToHighlight}
          onJumpToNote={handleJumpToNote}
          onOpenChange={(open) => {
            if (open) {
              useReaderStore.getState().openAnnotations();
            } else {
              closeAnnotations();
            }
          }}
          onRetryHighlights={() => void highlightsQuery.refetch()}
          onRetryNotes={() => void notesQuery.refetch()}
          open={annotationsOpen}
        />

        <TranslationSheet
          availableLanguages={translation.availableLanguages}
          currentLanguage={translation.currentLanguage}
          job={translation.job}
          onOpenChange={(open) => {
            if (open) {
              openTranslationSheet();
            } else {
              closeTranslationSheet();
            }
          }}
          onStart={async (language, replaceExisting) => {
            await translation.startMutation.mutateAsync({ language, replaceExisting });
            closeTranslationSheet();
          }}
          open={translationSheetOpen}
          pending={translation.startMutation.isPending}
        />

        {quoteCover ? (
          <QuoteCoverModal
            book={book}
            initialText={quoteCover.text}
            onOpenChange={(open) => {
              if (!open) {
                closeQuoteCover();
              }
            }}
            open={quoteCover.open}
          />
        ) : null}
      </div>
    </main>
  );
}
