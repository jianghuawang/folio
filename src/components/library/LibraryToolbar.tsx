import { Loader2, Search, X } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FileWithPath extends File {
  path?: string;
}

interface LibraryToolbarProps {
  importLabel?: string;
  isImporting: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onImportPaths: (filePaths: string[]) => void;
  onImportPickerError: (message: string) => void;
}

export function LibraryToolbar({
  importLabel = "Import Book",
  isImporting,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onImportPaths,
  onImportPickerError,
}: LibraryToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="border-b border-[--color-border] px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--color-text-muted]" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search library"
            className="h-10 rounded-full border-[--color-border-strong] bg-[--color-bg-elevated] pl-9 pr-10 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-3 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[--color-text-muted] transition hover:bg-white/10 hover:text-[--color-text-primary]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {isImporting ? (
            <div className="inline-flex items-center gap-2 text-sm text-[--color-text-secondary]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Importing…</span>
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept=".epub,application/epub+zip"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              const filePaths = files
                .map((file) => (file as FileWithPath).path)
                .filter((value): value is string => Boolean(value));

              if (files.length > 0 && filePaths.length === 0) {
                onImportPickerError(
                  "The import picker did not expose file paths in this runtime. Use drag and drop instead.",
                );
              } else if (filePaths.length > 0) {
                onImportPaths(filePaths);
              }

              event.target.value = "";
            }}
          />

          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full bg-[--color-primary] px-5 text-white hover:brightness-90"
            disabled={isImporting}
          >
            {importLabel} +
          </Button>
        </div>
      </div>
    </header>
  );
}
