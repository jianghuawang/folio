import { useEffect, useMemo, useState } from "react";
import { message, open } from "@tauri-apps/plugin-dialog";

import { BookContextMenu } from "@/components/library/BookContextMenu";
import { BookGrid } from "@/components/library/BookGrid";
import { BookInfoSheet } from "@/components/library/BookInfoSheet";
import { DropZone } from "@/components/library/DropZone";
import { DuplicateBanner } from "@/components/library/DuplicateBanner";
import { EmptyState } from "@/components/library/EmptyState";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import { Sidebar } from "@/components/library/Sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useBooks, useDeleteBook, useImportBooks } from "@/hooks/useBooks";
import { useLibraryFilter } from "@/hooks/useLibraryFilter";
import { openReaderWindow } from "@/lib/tauri-commands";
import { useLibraryStore } from "@/store/libraryStore";
import type { Book } from "@/types/book";

interface ContextMenuState {
  book: Book;
  x: number;
  y: number;
}

function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[--color-border] bg-[--color-bg-elevated] p-6 text-center">
      <p className="text-sm text-[--color-destructive]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 text-sm text-[--color-primary] underline underline-offset-4"
      >
        Retry
      </button>
    </div>
  );
}

export default function LibraryWindow() {
  const setImportInProgress = useLibraryStore((state) => state.setImportInProgress);
  const importInProgress = useLibraryStore((state) => state.importInProgress);
  const duplicateTitles = useLibraryStore((state) => state.duplicateTitles);
  const setDuplicateTitles = useLibraryStore((state) => state.setDuplicateTitles);
  const clearDuplicateTitles = useLibraryStore((state) => state.clearDuplicateTitles);
  const dropZoneVisible = useLibraryStore((state) => state.dropZoneVisible);
  const setDropZoneVisible = useLibraryStore((state) => state.setDropZoneVisible);

  const allBooksQuery = useBooks("all");
  const recentBooksQuery = useBooks("recent");
  const importBooksMutation = useImportBooks();
  const deleteBookMutation = useDeleteBook();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [bookInfoId, setBookInfoId] = useState<string | null>(null);
  const [bookInfoOpen, setBookInfoOpen] = useState(false);
  const [sidebarSheetOpen, setSidebarSheetOpen] = useState(false);

  const {
    section,
    searchQuery,
    debouncedQuery,
    isSearchActive,
    filteredBooks,
    setSection,
    setSearchQuery,
    clearSearch,
  } = useLibraryFilter({
    allBooks: allBooksQuery.data ?? [],
    recentBooks: recentBooksQuery.data ?? [],
  });

  const activeQuery = isSearchActive || section === "all" ? allBooksQuery : recentBooksQuery;
  const heading = isSearchActive ? `${filteredBooks.length} books match "${debouncedQuery}"` : section === "recent" ? "Recently Read" : "All";
  const isLibraryEmpty = !allBooksQuery.isLoading && (allBooksQuery.data?.length ?? 0) === 0;
  const hasSearchNoResults = isSearchActive && !activeQuery.isLoading && filteredBooks.length === 0;
  const isGridLoading = activeQuery.isLoading;

  const openContextMenu = (book: Book, x: number, y: number) => {
    setContextMenu({ book, x, y });
  };

  const showImportMessage = async (content: string) => {
    try {
      await message(content, {
        title: "Folio",
        kind: "error",
      });
    } catch {
      window.alert(content);
    }
  };

  const normalizeDialogSelection = (selection: unknown): string[] => {
    if (Array.isArray(selection)) {
      return selection.filter((value): value is string => typeof value === "string");
    }

    if (typeof selection === "string") {
      return [selection];
    }

    return [];
  };

  const handleImportClick = async () => {
    try {
      const selection = await open({
        multiple: true,
        directory: false,
        fileAccessMode: "copy",
        title: "Import Book",
        filters: [
          {
            name: "ePub Books",
            extensions: ["epub"],
          },
        ],
      });

      const filePaths = normalizeDialogSelection(selection);

      if (filePaths.length > 0) {
        await runImport(filePaths);
      } else if (selection !== null) {
        await showImportMessage("The selected files could not be read by Folio.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to open the import dialog.";
      await showImportMessage(message);
    }
  };

  const runImport = async (filePaths: string[]) => {
    if (filePaths.length === 0) {
      return;
    }

    setImportInProgress(true);

    try {
      const result = await importBooksMutation.mutateAsync(filePaths);

      if (result.duplicates.length > 0) {
        setDuplicateTitles(result.duplicates.map((duplicate) => duplicate.title));
      }

      if (result.errors.length > 0) {
        const firstError = result.errors[0];
        await showImportMessage(
          `'${firstError.filename}' could not be imported. The file may be corrupted or is not a valid ePub.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import the selected book.";
      await showImportMessage(message);
    } finally {
      setImportInProgress(false);
      setDropZoneVisible(false);
    }
  };

  const handleOpenBook = async (bookId: string) => {
    try {
      await openReaderWindow(bookId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "This book's managed library file is missing or corrupted. Re-import the book to read it again.";
      void showImportMessage(message);
    }
  };

  const deleteTargetBook = contextMenu?.book ?? null;

  const subtitle = useMemo(() => {
    if (isSearchActive) {
      return null;
    }

    return section === "recent"
      ? "Books opened in the last 30 days."
      : `${allBooksQuery.data?.length ?? 0} books in your library.`;
  }, [allBooksQuery.data?.length, isSearchActive, section]);

  useEffect(() => {
    const standardLayoutQuery = window.matchMedia("(min-width: 700px) and (max-width: 999px)");

    const syncSidebarSheet = () => {
      if (!standardLayoutQuery.matches) {
        setSidebarSheetOpen(false);
      }
    };

    syncSidebarSheet();
    standardLayoutQuery.addEventListener("change", syncSidebarSheet);

    return () => {
      standardLayoutQuery.removeEventListener("change", syncSidebarSheet);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[--color-bg-window] text-[--color-text-primary]">
      <DuplicateBanner titles={duplicateTitles} onDismiss={clearDuplicateTitles} />
      <DropZone onFiles={runImport} onVisibilityChange={setDropZoneVisible} />

      {dropZoneVisible ? (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="rounded-[20px] border border-dashed border-[--color-primary] bg-[--color-bg-surface]/95 px-10 py-8 text-center shadow-popup">
            <p className="text-lg font-medium text-[--color-text-primary]">Drop .epub files here</p>
            <p className="mt-2 text-sm text-[--color-text-muted]">
              Folio will import them into its managed library.
            </p>
          </div>
        </div>
      ) : null}

      <Sheet open={sidebarSheetOpen} onOpenChange={setSidebarSheetOpen}>
        <SheetContent
          side="left"
          className="w-[250px] border-r border-[--color-border] bg-[--color-bg-sidebar] p-0 text-[--color-text-primary] sm:max-w-[250px]"
        >
          <Sidebar
            activeSection={section}
            allCount={allBooksQuery.data?.length ?? 0}
            recentCount={recentBooksQuery.data?.length ?? 0}
            onSectionChange={(nextSection) => {
              setSection(nextSection);
              setSidebarSheetOpen(false);
            }}
            variant="sheet"
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen">
        <Sidebar
          activeSection={section}
          allCount={allBooksQuery.data?.length ?? 0}
          recentCount={recentBooksQuery.data?.length ?? 0}
          onSectionChange={setSection}
        />

        <section className="relative isolate flex min-h-screen flex-1 flex-col bg-[--color-bg-content]">
          <LibraryToolbar
            isImporting={importInProgress || importBooksMutation.isPending}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClearSearch={clearSearch}
            onImportClick={() => void handleImportClick()}
            onToggleSidebar={() => setSidebarSheetOpen(true)}
          />

          <div className="relative z-0 flex-1 px-6 py-8">
            <div className="mx-auto max-w-[1504px]">
              <div className="mb-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[--color-text-section]">
                  Library
                </p>
                <h1 className="mt-1 text-[28px] font-bold tracking-tight text-[--color-text-primary]">
                  {heading}
                </h1>
                {subtitle ? (
                  <p className="mt-2 text-sm text-[--color-text-muted]">{subtitle}</p>
                ) : null}
              </div>

              {activeQuery.error ? (
                <InlineError
                  message="Failed to load the library."
                  onRetry={() => void activeQuery.refetch()}
                />
              ) : isLibraryEmpty && !isSearchActive ? (
                <EmptyState onImportClick={() => void handleImportClick()} />
              ) : hasSearchNoResults ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <p className="text-lg text-[--color-text-primary]">
                    No books match &quot;{debouncedQuery}&quot;.
                  </p>
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="mt-3 text-sm text-[--color-primary] underline underline-offset-4"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                <BookGrid
                  books={filteredBooks}
                  isLoading={isGridLoading}
                  onOpen={handleOpenBook}
                  onContextMenu={openContextMenu}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      <BookContextMenu
        open={Boolean(contextMenu)}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onDismiss={() => setContextMenu(null)}
        onOpenBook={() => {
          if (contextMenu) {
            void handleOpenBook(contextMenu.book.id);
          }
        }}
        onShowInfo={() => {
          if (contextMenu) {
            setBookInfoId(contextMenu.book.id);
            setBookInfoOpen(true);
          }
        }}
        onRemoveBook={() => {
          if (!deleteTargetBook) {
            return;
          }

          const confirmed = window.confirm(
            `Remove '${deleteTargetBook.title}' from your library?`,
          );

          if (!confirmed) {
            return;
          }

          void deleteBookMutation
            .mutateAsync(deleteTargetBook.id)
            .catch((error) => {
              const message =
                error instanceof Error ? error.message : "Failed to remove the book.";
              void showImportMessage(message);
            });
        }}
      />

      <BookInfoSheet
        bookId={bookInfoId}
        open={bookInfoOpen}
        onOpenChange={(open) => {
          setBookInfoOpen(open);
          if (!open) {
            setBookInfoId(null);
          }
        }}
      />
    </main>
  );
}
