import { useEffect, useState } from "react";
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
import { isMacOS } from "@/lib/platform";
import { FolioError, openReaderWindow } from "@/lib/tauri-commands";
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
    <div className="mx-auto max-w-md rounded-[12px] border border-white/[0.08] bg-white/[0.04] p-6 text-center">
      <p className="text-[13px] text-[--color-destructive]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 text-[13px] font-medium text-[#0a84ff] transition-colors hover:text-[#409cff]"
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
  const heading = isSearchActive ? `${filteredBooks.length} books match "${debouncedQuery}"` : section === "recent" ? "Recently Read" : "All Books";
  const isLibraryEmpty = !allBooksQuery.isLoading && (allBooksQuery.data?.length ?? 0) === 0;
  const hasSearchNoResults = isSearchActive && !activeQuery.isLoading && filteredBooks.length === 0;
  const hasNoRecentBooks =
    section === "recent" && !isSearchActive && !activeQuery.isLoading && filteredBooks.length === 0;
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
      if (error instanceof FolioError && error.code === "MANAGED_FILE_INVALID") {
        void showImportMessage(
          "This book's managed library file is missing or corrupted. Re-import the book to read it again.",
        );
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "This book's managed library file is missing or corrupted. Re-import the book to read it again.";
      void showImportMessage(message);
    }
  };

  const deleteTargetBook = contextMenu?.book ?? null;

  useEffect(() => {
    if (!isMacOS) {
      return undefined;
    }

    // Let the macOS sidebar vibrancy material show through behind the window.
    document.body.classList.add("vibrant-window");

    return () => {
      document.body.classList.remove("vibrant-window");
    };
  }, []);

  useEffect(() => {
    const compactLayoutQuery = window.matchMedia("(max-width: 999px)");

    const syncSidebarSheet = () => {
      if (!compactLayoutQuery.matches) {
        setSidebarSheetOpen(false);
      }
    };

    syncSidebarSheet();
    compactLayoutQuery.addEventListener("change", syncSidebarSheet);

    return () => {
      compactLayoutQuery.removeEventListener("change", syncSidebarSheet);
    };
  }, []);

  return (
    <main
      className={[
        "flex h-screen w-full overflow-hidden text-[--color-text-primary]",
        isMacOS ? "bg-transparent" : "bg-[#232326]",
      ].join(" ")}
    >
      <DuplicateBanner titles={duplicateTitles} onDismiss={clearDuplicateTitles} />
      <DropZone onFiles={runImport} onVisibilityChange={setDropZoneVisible} />

      {dropZoneVisible ? (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-6 backdrop-blur-[2px]">
          <div className="rounded-[14px] border border-dashed border-[#0a84ff]/80 bg-[#28282a]/95 px-12 py-9 text-center shadow-popup">
            <p className="text-[15px] font-semibold text-white/90">Drop ePub files to import</p>
            <p className="mt-1.5 text-[13px] text-white/45">
              Folio will add them to your library.
            </p>
          </div>
        </div>
      ) : null}

      <Sheet open={sidebarSheetOpen} onOpenChange={setSidebarSheetOpen}>
        <SheetContent
          side="left"
          className="w-[230px] border-r border-white/[0.06] bg-[#232326] p-0 text-[--color-text-primary] sm:max-w-[230px]"
        >
          <Sidebar
            activeSection={section}
            onSectionChange={(nextSection) => {
              setSection(nextSection);
              setSidebarSheetOpen(false);
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClearSearch={clearSearch}
            variant="sheet"
          />
        </SheetContent>
      </Sheet>

      <Sidebar
        activeSection={section}
        onSectionChange={setSection}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={clearSearch}
      />

      <section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#1e1e1e] min-[1000px]:border-l min-[1000px]:border-black/50">
        <LibraryToolbar
          isImporting={importInProgress || importBooksMutation.isPending}
          onImportClick={() => void handleImportClick()}
          onToggleSidebar={() => setSidebarSheetOpen(true)}
        />

        <div className="flex-1 overflow-y-auto px-8 pb-12 pt-1 min-[1000px]:px-10">
          <div className="w-full max-w-[1504px]">
            <div className="mb-7">
              <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-white">
                {heading}
              </h1>
              {isSearchActive ? (
                <p className="mt-2 text-[13px] text-white/45">Showing matches for “{debouncedQuery}”.</p>
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
                <p className="text-[15px] font-medium text-white/85">
                  No books match &quot;{debouncedQuery}&quot;
                </p>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-2.5 text-[13px] font-medium text-[#0a84ff] transition-colors hover:text-[#409cff]"
                >
                  Clear Search
                </button>
              </div>
            ) : hasNoRecentBooks ? (
              <div className="flex min-h-[320px] items-center justify-center text-center">
                <p className="text-[15px] font-medium text-white/65">No recently read books.</p>
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
