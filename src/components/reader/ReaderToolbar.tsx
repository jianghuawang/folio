import {
  Download,
  Languages,
  Menu,
  NotebookTabs,
  Palette,
} from "lucide-react";
import type { ReactNode } from "react";

import { DisplaySettingsPopover } from "@/components/reader/DisplaySettingsPopover";
import { Button } from "@/components/ui/button";
import type { ReadingSettings, ReadingTheme } from "@/types/settings";

interface ReaderToolbarProps {
  canExport: boolean;
  canTranslate: boolean;
  onCycleTheme: () => void;
  onExport: () => void;
  onOpenTranslationSheet: () => void;
  onToggleAnnotations: () => void;
  onToggleBilingualMode: () => void;
  onToggleToc: () => void;
  onUpdateReadingSettings: (payload: Partial<ReadingSettings>) => void;
  readingSettings: ReadingSettings;
  showBilingualToggle: boolean;
  title: string;
  visible: boolean;
}

function ToolbarIconButton({
  disabled = false,
  icon,
  label,
  onClick,
}: {
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
      className="h-10 w-10 rounded-full text-black/70 disabled:opacity-100 hover:bg-black/[0.05] hover:text-black/85"
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  );
}

function nextThemeLabel(theme: ReadingTheme) {
  if (theme === "light") {
    return "Switch to Sepia theme";
  }

  if (theme === "sepia") {
    return "Switch to Dark theme";
  }

  return "Switch to Light theme";
}

export function ReaderToolbar({
  canExport,
  canTranslate,
  onCycleTheme,
  onExport,
  onOpenTranslationSheet,
  onToggleAnnotations,
  onToggleBilingualMode,
  onToggleToc,
  onUpdateReadingSettings,
  readingSettings,
  showBilingualToggle,
  title,
  visible,
}: ReaderToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-3">
      <div
        className={[
          "absolute left-5 top-3 flex items-center transition-opacity duration-200 ease-out",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center rounded-full border border-black/5 bg-white/92 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.10)] backdrop-blur-xl">
          <ToolbarIconButton
            icon={<Menu className="h-5 w-5 stroke-[1.75]" />}
            label="Table of contents"
            onClick={onToggleToc}
          />
          <ToolbarIconButton
            icon={<Palette className="h-5 w-5 stroke-[1.75]" />}
            label={nextThemeLabel(readingSettings.theme)}
            onClick={onCycleTheme}
          />
          <ToolbarIconButton
            icon={<NotebookTabs className="h-5 w-5 stroke-[1.75]" />}
            label="Annotations"
            onClick={onToggleAnnotations}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 px-4 text-center text-[13px] font-semibold tracking-[0.01em] text-black/80">
        {title}
      </div>

      <div
        className={[
          "absolute right-5 top-3 flex items-center transition-opacity duration-200 ease-out",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center rounded-full border border-black/5 bg-white/92 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.10)] backdrop-blur-xl">
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
