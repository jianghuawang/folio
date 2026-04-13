import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

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
  useExportHighlights,
  useHighlights,
  useUpdateHighlight,
} from "@/hooks/useHighlights";
import { useDeleteNote, useNotes, useSaveNote, useUpdateNote } from "@/hooks/useNotes";
import { FolioError } from "@/lib/tauri-commands";
import { useReadingSettings, useUpdateReadingSettings } from "@/hooks/useReadingSettings";
import { useTranslation } from "@/hooks/useTranslation";
import type { Highlight, Note } from "@/types/annotation";
import type {
  EpubBridge,
  ReaderLocationState,
  ReaderNoteActivationPayload,
  ReaderTocItem,
} from "@/lib/epub-bridge";
import { useReaderStore } from "@/store/readerStore";

const API_KEY_STATUS_CHANGED_EVENT = "settings:api-key-status-changed";

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

function getHighlightStartCfi(highlight: Highlight) {
  const [startFragment] = highlight.cfi_range.split(",");
  return startFragment.endsWith(")") ? startFragment : highlight.cfi_range;
}

function getLegacyNoteOnlyHighlight(note: Note, highlightById: Map<string, Highlight>) {
  if (!note.highlight_id) {
    return null;
  }

  const linkedHighlight = highlightById.get(note.highlight_id);
  if (!linkedHighlight) {
    return null;
  }

  if (
    linkedHighlight.color === "#FFD60A" &&
    linkedHighlight.cfi_range === note.cfi &&
    linkedHighlight.text_excerpt === note.text_excerpt
  ) {
    return linkedHighlight;
  }

  return null;
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
  const exportHighlightsMutation = useExportHighlights(bookId, book?.title ?? "Book");
  const notesQuery = useNotes(bookId);
  const saveNoteMutation = useSaveNote(bookId);
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();
  const apiKeyStatusQuery = useApiKeyStatus();
  const refetchApiKeyStatus = apiKeyStatusQuery.refetch;
  const selectionController = useEpubSelection();
  const translation = useTranslation(bookId, book?.title ?? "Book");
  const clearSelection = selectionController.clearSelection;
  const handleSelectionChange = selectionController.handleSelectionChange;
  const showHighlightSelection = selectionController.showHighlightSelection;

  const bridge = useReaderStore((state) => state.bridge);
  const closeAnnotations = useReaderStore((state) => state.closeAnnotations);
  const closeNoteEditor = useReaderStore((state) => state.closeNoteEditor);
  const closeQuoteCover = useReaderStore((state) => state.closeQuoteCover);
  const closeTranslationSheet = useReaderStore((state) => state.closeTranslationSheet);
  const invalidPositionRestore = useReaderStore((state) => state.invalidPositionRestore);
  const noteEditor = useReaderStore((state) => state.noteEditor);
  const openNoteEditor = useReaderStore((state) => state.openNoteEditor);
  const openQuoteCover = useReaderStore((state) => state.openQuoteCover);
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
  const annotationsTab = useReaderStore((state) => state.annotationsTab);
  const openAnnotations = useReaderStore((state) => state.openAnnotations);
  const setAnnotationsTab = useReaderStore((state) => state.setAnnotationsTab);
  const toggleAnnotations = useReaderStore((state) => state.toggleAnnotations);
  const openToc = useReaderStore((state) => state.openToc);
  const translationSheetOpen = useReaderStore((state) => state.translationSheetOpen);
  const openTranslationSheet = useReaderStore((state) => state.openTranslationSheet);
  const toggleTranslationSheet = useReaderStore((state) => state.toggleTranslationSheet);

  const [tocItems, setTocItems] = useState<ReaderTocItem[]>([]);
  const lastTranslationErrorRef = useRef<string | null>(null);
  const highlightsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const leftClusterRef = useRef<HTMLDivElement | null>(null);
  const notesTriggerRef = useRef<HTMLButtonElement | null>(null);
  const tocTriggerRef = useRef<HTMLButtonElement | null>(null);
  const translationClusterRef = useRef<HTMLDivElement | null>(null);
  const translationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const allHighlights = highlightsQuery.data ?? [];

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    let unlistenFocus: (() => void) | null = null;
    let unlistenApiKeyStatusChanged: (() => void) | null = null;

    void currentWindow
      .onFocusChanged(({ payload }) => {
        if (payload) {
          void refetchApiKeyStatus();
        }
      })
      .then((unlisten) => {
        unlistenFocus = unlisten;
      });

    void listen(API_KEY_STATUS_CHANGED_EVENT, () => {
      void refetchApiKeyStatus();
    }).then((unlisten) => {
      unlistenApiKeyStatusChanged = unlisten;
    });

    return () => {
      unlistenFocus?.();
      unlistenApiKeyStatusChanged?.();
    };
  }, [refetchApiKeyStatus]);

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
      return;
    }

    if (translation.latestError.paragraph_index === -1) {
      window.alert(`Translation failed: ${translation.latestError.error_message}`);
    }
  }, [translation.latestError]);

  const highlightById = useMemo(
    () =>
      new Map<string, Highlight>(
        allHighlights.map((highlight): [string, Highlight] => [highlight.id, highlight]),
      ),
    [allHighlights],
  );

  useEffect(() => {
    if (!bridge) {
      clearAnnotationMeta();
      return;
    }

    const items = [
      ...allHighlights.map((highlight) => ({
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
    allHighlights,
    bridge,
    clearAnnotationMeta,
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
      allHighlights.map((highlight) => ({
        highlight,
        meta: useReaderStore.getState().annotationMetaByKey[`highlight:${highlight.id}`] ?? null,
      })),
    [allHighlights],
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

    return allHighlights.find((highlight) => highlight.id === selection.highlightId) ?? null;
  }, [allHighlights, selection?.highlightId]);

  const activeNote = useMemo(() => {
    if (!noteEditor) {
      return null;
    }

    return (notesQuery.data ?? []).find((note) => note.id === noteEditor.noteId) ?? null;
  }, [noteEditor, notesQuery.data]);

  const exportHighlightsErrorMessage = useMemo(() => {
    if (!(exportHighlightsMutation.error instanceof FolioError)) {
      return null;
    }

    if (exportHighlightsMutation.error.code === "NO_HIGHLIGHTS") {
      return "No highlights to export yet.";
    }

    if (exportHighlightsMutation.error.code === "UNSUPPORTED_EXPORT_FORMAT") {
      return "Choose a .md or .csv file.";
    }

    if (exportHighlightsMutation.error.code === "WRITE_ERROR") {
      return "Could not write the export file.";
    }

    return "Failed to export highlights.";
  }, [exportHighlightsMutation.error]);

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
      } else {
        await addHighlightMutation.mutateAsync({
          cfiRange: selection.cfiRange,
          color,
          textExcerpt: selection.text,
        });
      }
      clearSelection();
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

    const nextSelection = selection;
    const existingNote =
      nextSelection.highlightId
        ? (notesQuery.data ?? []).find((note) => note.highlight_id === nextSelection.highlightId)
        : null;

    openNoteEditor({
      cfi: nextSelection.cfiRange,
      highlightId: nextSelection.highlightId,
      noteId: existingNote?.id ?? null,
      position: nextSelection.position,
      textExcerpt: nextSelection.text,
    });
    clearSelection();
  };

  const handleSaveNote = async (body: string) => {
    if (!bookId || !noteEditor) {
      return;
    }

    try {
      if (noteEditor.noteId) {
        const updatedNote = await updateNoteMutation.mutateAsync({
          body,
          bookId,
          id: noteEditor.noteId,
        });

        if (!updatedNote && activeNote) {
          const linkedHighlight = getLegacyNoteOnlyHighlight(activeNote, highlightById);
          if (linkedHighlight) {
            await deleteHighlightMutation
              .mutateAsync({
                bookId,
                id: linkedHighlight.id,
              })
              .catch(() => undefined);
          }
        }
      } else {
        let highlightId = noteEditor.highlightId;

        if (!highlightId) {
          const createdHighlight = await addHighlightMutation.mutateAsync({
            cfiRange: noteEditor.cfi,
            color: "#FFD60A",
            textExcerpt: noteEditor.textExcerpt,
          });

          highlightId = createdHighlight.id;
        }

        await saveNoteMutation.mutateAsync({
          body,
          cfi: noteEditor.cfi,
          highlightId,
          textExcerpt: noteEditor.textExcerpt,
        });
      }

      closeNoteEditor();
      clearSelection();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "An error occurred saving your data. Your changes may not be saved.";
      window.alert(message);
    }
  };

  const handleDeleteNote = async () => {
    if (!bookId || !noteEditor?.noteId || !activeNote) {
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

    const linkedHighlight = getLegacyNoteOnlyHighlight(activeNote, highlightById);
    if (linkedHighlight) {
      await deleteHighlightMutation
        .mutateAsync({
          bookId,
          id: linkedHighlight.id,
        })
        .catch(() => undefined);
    }

    closeNoteEditor();
  };

  const handleJumpToHighlight = (highlight: Highlight) => {
    void bridge?.goToCfi(getHighlightStartCfi(highlight));
    closeAnnotations();
  };

  const handleJumpToNote = (note: NonNullable<(typeof notesQuery.data)>[number]) => {
    void bridge?.goToCfi(note.cfi);
    closeAnnotations();
  };

  const handleHighlightActivate = useCallback(
    (payload: {
      cfiRange: string;
      highlightId: string;
      position: { left: number; top: number };
      text: string;
    }) => {
      showHighlightSelection(payload);
    },
    [showHighlightSelection],
  );

  const handleNoteActivate = useCallback(
    ({ note, position }: ReaderNoteActivationPayload) => {
      clearSelection();
      openNoteEditor({
        cfi: note.cfi,
        highlightId: note.highlight_id,
        noteId: note.id,
        position,
        textExcerpt: note.text_excerpt,
      });
    },
    [clearSelection, openNoteEditor],
  );

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

  const handleRemoveHighlightFromPopup = () => {
    if (!bookId || !selection?.highlightId) {
      return;
    }

    void deleteHighlightMutation
      .mutateAsync({
        bookId,
        id: selection.highlightId,
      })
      .finally(() => {
        clearSelection();
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

    const note = (notesQuery.data ?? []).find((item) => item.id === noteId);
    const linkedHighlight = note ? getLegacyNoteOnlyHighlight(note, highlightById) : null;

    void deleteNoteMutation
      .mutateAsync({
        bookId,
        id: noteId,
      })
      .then(async () => {
        if (linkedHighlight) {
          await deleteHighlightMutation
            .mutateAsync({
              bookId,
              id: linkedHighlight.id,
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (selection && noteEditor) {
      closeNoteEditor();
    }
  }, [closeNoteEditor, noteEditor, selection]);

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
      className={[
        "h-screen overflow-hidden text-[--color-text-primary]",
        currentReadingSettings.theme === "dark" ? "bg-[#2c2c2e]" : "bg-[--color-bg-window]",
      ].join(" ")}
    >
      <div className="group relative h-full w-full overflow-hidden">
        <EpubViewer
          bilingualMode={translation.bilingualMode}
          book={book}
          highlights={allHighlights}
          notes={notesQuery.data ?? []}
          onBridgeReady={handleBridgeReady}
          onHighlightActivate={handleHighlightActivate}
          onLocationChange={handleLocationChange}
          onNoteActivate={handleNoteActivate}
          onPositionRestoreError={handlePositionRestoreError}
          onSelectionChange={handleSelectionChange}
          readingSettings={currentReadingSettings}
          translations={translation.translations}
        />

        <ReaderToolbar
          annotationsOpen={annotationsOpen}
          annotationsTab={annotationsTab}
          canExport={translation.canExport}
          canTranslate={apiKeyStatusQuery.data?.configured ?? false}
          highlightsTriggerRef={highlightsTriggerRef}
          leftClusterRef={leftClusterRef}
          notesTriggerRef={notesTriggerRef}
          onExport={() => void translation.exportMutation.mutateAsync()}
          onOpenHighlights={() => toggleAnnotations("highlights")}
          onOpenNotes={() => toggleAnnotations("notes")}
          onToggleTranslation={() => {
            translation.clearStartError();
            toggleTranslationSheet();
          }}
          onToggleBilingualMode={() => translation.setBilingualMode(!translation.bilingualMode)}
          onToggleToc={toggleToc}
          onUpdateReadingSettings={(payload) => void updateReadingSettingsMutation.mutateAsync(payload)}
          readingSettings={currentReadingSettings}
          showBilingualToggle={Boolean(translation.currentLanguage)}
          tocOpen={tocOpen}
          tocTriggerRef={tocTriggerRef}
          title={book.title}
          translationClusterRef={translationClusterRef}
          translationOpen={translationSheetOpen}
          translationTriggerRef={translationTriggerRef}
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
          theme={currentReadingSettings.theme}
          onPrev={() => {
            void bridge?.prev();
          }}
          onNext={() => {
            void bridge?.next();
          }}
        />

        <ProgressBar
          chapterTitle={location.chapterTitle}
          progress={location.progress}
          theme={currentReadingSettings.theme}
        />

        <TocDrawer
          anchorElement={tocTriggerRef.current}
          clusterElement={leftClusterRef.current}
          currentHref={location.href}
          items={tocItems}
          open={tocOpen}
          onOpenChange={(open) => {
            if (open) {
              openToc();
            } else {
              useReaderStore.getState().closeToc();
            }
          }}
          onSelect={(href) => {
            void bridge?.goToHref(href);
            useReaderStore.getState().closeToc();
          }}
        />

        <SelectionPopup
          activeColor={activeHighlight?.color ?? null}
          onColorSelect={handleColorSelect}
          onOpenNote={handleOpenNoteEditor}
          onOpenQuote={() => {
            if (selection) {
              openQuoteCover(selection.text);
              clearSelection();
            }
          }}
          onRemoveHighlight={handleRemoveHighlightFromPopup}
          position={selection?.position ?? { left: 0, top: 0 }}
          showRemoveHighlight={Boolean(selection?.highlightId)}
          visible={Boolean(selection) && !noteEditor}
        />

        {noteEditor ? (
          <NoteEditor
            initialBody={activeNote?.body ?? ""}
            onCancel={closeNoteEditor}
            onDelete={activeNote ? handleDeleteNote : undefined}
            onSave={handleSaveNote}
            position={noteEditor.position}
            textExcerpt={noteEditor.textExcerpt}
          />
        ) : null}

        <AnnotationsDrawer
          activeTab={annotationsTab}
          anchorElement={
            annotationsTab === "notes" ? notesTriggerRef.current : highlightsTriggerRef.current
          }
          clusterElement={leftClusterRef.current}
          exportDisabled={allHighlights.length === 0}
          exportErrorMessage={exportHighlightsErrorMessage}
          exportPending={exportHighlightsMutation.isPending}
          highlightError={Boolean(highlightsQuery.error)}
          highlightItems={highlightItems}
          highlightsLoading={highlightsQuery.isLoading}
          noteError={Boolean(notesQuery.error)}
          noteItems={noteItems}
          notesLoading={notesQuery.isLoading}
          onDeleteHighlight={handleDeleteHighlight}
          onDeleteNote={handleDeleteDrawerNote}
          onExportHighlights={() => exportHighlightsMutation.mutate()}
          onJumpToHighlight={handleJumpToHighlight}
          onJumpToNote={handleJumpToNote}
          onOpenChange={(open) => {
            if (open) {
              openAnnotations(annotationsTab);
            } else {
              closeAnnotations();
            }
          }}
          onRetryHighlights={() => void highlightsQuery.refetch()}
          onRetryNotes={() => void notesQuery.refetch()}
          onTabChange={setAnnotationsTab}
          open={annotationsOpen}
        />

        <TranslationSheet
          anchorElement={translationTriggerRef.current}
          availableLanguages={translation.availableLanguages}
          clusterElement={translationClusterRef.current}
          currentLanguage={translation.currentLanguage}
          errorMessage={translation.startError}
          job={translation.job}
          onOpenChange={(open) => {
            if (open) {
              translation.clearStartError();
              openTranslationSheet();
            } else {
              translation.clearStartError();
              closeTranslationSheet();
            }
          }}
          onStart={async (language, replaceExisting) => {
            try {
              await translation.startMutation.mutateAsync({ language, replaceExisting });
              closeTranslationSheet();
            } catch (error) {
              if (error instanceof FolioError) {
                if (error.code === "JOB_ALREADY_EXISTS") {
                  await translation.activateLanguage(language);
                  closeTranslationSheet();
                  return;
                }

                if (error.code === "TRANSLATION_ALREADY_COMPLETE") {
                  await translation.activateLanguage(language);
                  return;
                }

                if (error.code === "NO_API_KEY") {
                  void refetchApiKeyStatus();
                  return;
                }
              }
            }
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
