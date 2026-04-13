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
    <header className="relative z-20 shrink-0 px-8 pb-0 pt-7 min-[1000px]:px-12 min-[1000px]:pt-8">
      <div className="flex min-h-[52px] items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden h-11 w-11 items-center justify-center rounded-[14px] border border-white/[0.07] bg-[#232227]/80 text-white/68 transition hover:bg-[#28272d] hover:text-white/90 min-[700px]:inline-flex min-[1000px]:hidden"
            aria-label="Open library navigation"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>

          <div className="relative w-full max-w-[348px] shrink-0">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search"
              className="h-[52px] rounded-[16px] border-white/[0.07] bg-[#232227]/80 pl-11 pr-10 text-[15px] text-white/88 placeholder:text-white/36 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-3 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-white/34 transition hover:bg-white/[0.05] hover:text-white/72"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isImporting ? (
            <div className="inline-flex items-center gap-2 rounded-[14px] border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-white/68">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Importing…</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onImportClick}
            disabled={isImporting}
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[16px] border border-white/[0.08] bg-[#3a393f]/90 px-6 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:bg-[#434249] disabled:opacity-50"
          >
            <span>{importLabel}</span>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
