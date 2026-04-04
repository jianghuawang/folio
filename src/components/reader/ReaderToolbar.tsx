import {
  Bookmark,
  Download,
  Languages,
  Menu,
  NotebookTabs,
} from "lucide-react";
import type { ReactNode } from "react";

import { DisplaySettingsPopover } from "@/components/reader/DisplaySettingsPopover";
import { Button } from "@/components/ui/button";
import type { ReaderAnnotationsTab } from "@/store/readerStore";
import type { ReadingSettings } from "@/types/settings";

interface ReaderToolbarProps {
  annotationsOpen: boolean;
  annotationsTab: ReaderAnnotationsTab;
  canExport: boolean;
  canTranslate: boolean;
  onExport: () => void;
  onOpenHighlights: () => void;
  onOpenNotes: () => void;
  onOpenTranslationSheet: () => void;
  onToggleBilingualMode: () => void;
  onToggleToc: () => void;
  onUpdateReadingSettings: (payload: Partial<ReadingSettings>) => void;
  readingSettings: ReadingSettings;
  showBilingualToggle: boolean;
  tocOpen: boolean;
  title: string;
}

function ToolbarIconButton({
  active = false,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      className={[
        "h-10 w-10 rounded-full disabled:opacity-100",
        active
          ? "bg-black/10 text-black"
          : "text-black/70 hover:bg-black/[0.05] hover:text-black/85",
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  );
}

export function ReaderToolbar({
  annotationsOpen,
  annotationsTab,
  canExport,
  canTranslate,
  onExport,
  onOpenHighlights,
  onOpenNotes,
  onOpenTranslationSheet,
  onToggleBilingualMode,
  onToggleToc,
  onUpdateReadingSettings,
  readingSettings,
  showBilingualToggle,
  tocOpen,
  title,
}: ReaderToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-3">
      <div className="pointer-events-auto absolute left-5 top-5 flex items-center">
        <div className="flex items-center gap-1 rounded-full border border-black/5 bg-white/88 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.16)] backdrop-blur-[24px]">
          <ToolbarIconButton
            icon={<Menu className="h-5 w-5 stroke-[1.75]" />}
            active={tocOpen}
            label="Contents"
            onClick={onToggleToc}
          />
          <ToolbarIconButton
            icon={<Bookmark className="h-5 w-5 stroke-[1.75]" />}
            active={annotationsOpen && annotationsTab === "highlights"}
            label="Highlights"
            onClick={onOpenHighlights}
          />
          <ToolbarIconButton
            icon={<NotebookTabs className="h-5 w-5 stroke-[1.75]" />}
            active={annotationsOpen && annotationsTab === "notes"}
            label="Notes"
            onClick={onOpenNotes}
          />
        </div>
      </div>

      <div className="absolute left-1/2 top-7 max-w-[45vw] -translate-x-1/2 truncate px-4 text-center text-[15px] font-semibold tracking-[-0.02em] text-black/75">
        {title}
      </div>

      <div className="pointer-events-auto absolute right-5 top-5 flex items-center">
        <div className="flex items-center gap-1 rounded-full border border-[#ece7df] bg-white/92 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.14)] backdrop-blur-[20px]">
          <DisplaySettingsPopover
            disabled={false}
            onUpdate={onUpdateReadingSettings}
            settings={readingSettings}
          />

          <ToolbarIconButton
            disabled={!canTranslate}
            icon={<Languages className="h-5 w-5 stroke-[1.75]" />}
            label="Translate book"
            onClick={onOpenTranslationSheet}
          />

          {showBilingualToggle ? (
            <button
              type="button"
              onClick={onToggleBilingualMode}
              className="rounded-full px-3 py-2 text-sm font-medium text-black/70 transition hover:bg-black/[0.05] hover:text-black/85"
            >
              Bilingual
            </button>
          ) : null}

          {canExport ? (
            <ToolbarIconButton
              icon={<Download className="h-5 w-5 stroke-[1.75]" />}
              label="Export bilingual ePub"
              onClick={onExport}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
