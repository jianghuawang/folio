import { Loader2, PanelLeftOpen, Plus, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

interface LibraryToolbarProps {
  importLabel?: string;
  isImporting: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onImportClick: () => void;
  onToggleSidebar?: () => void;
}

export function LibraryToolbar({
  importLabel = "Import Book",
  isImporting,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onImportClick,
  onToggleSidebar,
}: LibraryToolbarProps) {
  return (
    <header className="relative z-20 shrink-0 px-8 pb-0 pt-10 min-[1000px]:px-10 min-[1000px]:pt-10">
      <div className="flex min-h-[36px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden h-8 w-8 items-center justify-center rounded-md text-white/50 transition hover:bg-white/[0.06] hover:text-white/80 min-[700px]:inline-flex min-[1000px]:hidden"
            aria-label="Open library navigation"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>

          <div className="relative w-full max-w-[240px] shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search"
              className="h-[32px] rounded-md border-white/[0.06] bg-white/[0.06] pl-8 pr-8 text-[13px] text-white/80 placeholder:text-white/30 focus:bg-white/[0.08]"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-2 top-1/2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full text-white/30 transition hover:text-white/60"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isImporting ? (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Importing…</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onImportClick}
            disabled={isImporting}
            className="inline-flex h-[32px] items-center justify-center gap-1.5 rounded-md bg-white/[0.06] px-3.5 text-[13px] font-medium text-white/70 transition hover:bg-white/[0.1] hover:text-white/90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{importLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
