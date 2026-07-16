import { Loader2, PanelLeftOpen, Plus } from "lucide-react";

import { isMacOS } from "@/lib/platform";

interface LibraryToolbarProps {
  importLabel?: string;
  isImporting: boolean;
  onImportClick: () => void;
  onToggleSidebar?: () => void;
}

export function LibraryToolbar({
  importLabel = "Import",
  isImporting,
  onImportClick,
  onToggleSidebar,
}: LibraryToolbarProps) {
  return (
    <header
      data-tauri-drag-region
      className="relative z-20 flex h-[52px] shrink-0 items-center gap-2 px-5"
    >
      {/* Traffic lights sit over the content pane when the sidebar is hidden. */}
      {isMacOS ? <div data-tauri-drag-region className="w-[64px] shrink-0 min-[1000px]:hidden" /> : null}

      <button
        type="button"
        onClick={onToggleSidebar}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white/85 min-[1000px]:hidden"
        aria-label="Open library navigation"
      >
        <PanelLeftOpen className="h-4 w-4 stroke-[1.8]" />
      </button>

      <div data-tauri-drag-region className="min-w-0 flex-1" />

      {isImporting ? (
        <div className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-white/45">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Importing…</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onImportClick}
        disabled={isImporting}
        title="Import ePub files"
        className="inline-flex h-[28px] shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-[13px] font-normal text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white/95 disabled:opacity-40"
      >
        <Plus className="h-[15px] w-[15px] stroke-[2]" aria-hidden="true" />
        <span>{importLabel}</span>
      </button>
    </header>
  );
}
