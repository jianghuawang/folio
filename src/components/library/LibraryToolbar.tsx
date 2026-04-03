import { Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

interface LibraryToolbarProps {
  importLabel?: string;
  isImporting: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onImportClick: () => void;
}

export function LibraryToolbar({
  importLabel = "Import Book",
  isImporting,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onImportClick,
}: LibraryToolbarProps) {
  return (
    <header className="relative z-20 shrink-0 border-b border-[--color-border] bg-[--color-bg-content] px-6 py-4">
      <div className="flex min-h-10 items-center">
        <div className="relative w-full max-w-[220px] shrink-0">
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
      </div>

      <div className="fixed right-6 top-4 z-40 flex items-center gap-3">
        {isImporting ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-[--color-bg-surface] px-3 py-2 text-sm text-[--color-text-secondary] shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Importing…</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onImportClick}
          disabled={isImporting}
          className="inline-flex h-10 min-w-[144px] items-center justify-center rounded-full bg-[--color-primary] px-5 text-sm font-medium text-white shadow-sm transition hover:brightness-90 disabled:opacity-50"
        >
          {importLabel}
          <span className="ml-2 text-base leading-none" aria-hidden="true">
            +
          </span>
        </button>
      </div>
    </header>
  );
}
