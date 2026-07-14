import {
  Bookmark,
  Download,
  Languages,
  Menu,
  NotebookTabs,
} from "lucide-react";
import type { ReactNode, Ref } from "react";

import { DisplaySettingsPopover } from "@/components/reader/DisplaySettingsPopover";
import { Button } from "@/components/ui/button";
import { isMacOS } from "@/lib/platform";
import type { ReaderAnnotationsTab } from "@/store/readerStore";
import type { ReadingSettings } from "@/types/settings";

interface ReaderToolbarProps {
  annotationsOpen: boolean;
  annotationsTab: ReaderAnnotationsTab;
  canExport: boolean;
  canTranslate: boolean;
  highlightsTriggerRef?: Ref<HTMLButtonElement>;
  leftClusterRef?: Ref<HTMLDivElement>;
  notesTriggerRef?: Ref<HTMLButtonElement>;
  onExport: () => void;
  onOpenHighlights: () => void;
  onOpenNotes: () => void;
  onToggleTranslation: () => void;
  onToggleBilingualMode: () => void;
  onToggleToc: () => void;
  onUpdateReadingSettings: (payload: Partial<ReadingSettings>) => void;
  readingSettings: ReadingSettings;
  showBilingualToggle: boolean;
  tocOpen: boolean;
  tocTriggerRef?: Ref<HTMLButtonElement>;
  title: string;
  translationClusterRef?: Ref<HTMLDivElement>;
  translationOpen: boolean;
  translationTriggerRef?: Ref<HTMLButtonElement>;
}

function isDarkReaderTheme(theme: ReadingSettings["theme"]) {
  return theme === "dark";
}

function clusterClassName(darkTheme: boolean) {
  return [
    "flex items-center gap-0.5 rounded-full p-1 backdrop-blur-xl",
    darkTheme
      ? "border border-white/[0.09] bg-[#28282a]/85 shadow-[0_0.5px_0_rgba(255,255,255,0.08)_inset,0_10px_30px_rgba(0,0,0,0.3)]"
      : "border border-black/[0.06] bg-white/85 shadow-[0_0.5px_0_rgba(255,255,255,0.7)_inset,0_10px_30px_rgba(0,0,0,0.1)]",
  ].join(" ");
}

function ToolbarIconButton({
  active = false,
  buttonRef,
  disabled = false,
  icon,
  label,
  onClick,
  theme,
}: {
  active?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  theme: ReadingSettings["theme"];
}) {
  const darkTheme = isDarkReaderTheme(theme);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      ref={buttonRef}
      className={[
        "h-9 w-9 rounded-full disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? darkTheme
            ? "bg-white/[0.14] text-white"
            : "bg-black/[0.09] text-black"
          : darkTheme
            ? "text-white/70 hover:bg-white/[0.08] hover:text-white/95"
            : "text-black/65 hover:bg-black/[0.05] hover:text-black/85",
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
  highlightsTriggerRef,
  leftClusterRef,
  notesTriggerRef,
  onExport,
  onOpenHighlights,
  onOpenNotes,
  onToggleTranslation,
  onToggleBilingualMode,
  onToggleToc,
  onUpdateReadingSettings,
  readingSettings,
  showBilingualToggle,
  tocOpen,
  tocTriggerRef,
  title,
  translationClusterRef,
  translationOpen,
  translationTriggerRef,
}: ReaderToolbarProps) {
  const darkTheme = isDarkReaderTheme(readingSettings.theme);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
      {/* Left cluster clears the macOS traffic lights. */}
      <div
        className={[
          "pointer-events-auto absolute top-3 flex items-center",
          isMacOS ? "left-[86px]" : "left-4",
        ].join(" ")}
      >
        <div ref={leftClusterRef} className={clusterClassName(darkTheme)}>
          <ToolbarIconButton
            buttonRef={tocTriggerRef}
            icon={<Menu className="h-[18px] w-[18px] stroke-[1.75]" />}
            active={tocOpen}
            label="Contents"
            onClick={onToggleToc}
            theme={readingSettings.theme}
          />
          <ToolbarIconButton
            buttonRef={highlightsTriggerRef}
            icon={<Bookmark className="h-[18px] w-[18px] stroke-[1.75]" />}
            active={annotationsOpen && annotationsTab === "highlights"}
            label="Highlights"
            onClick={onOpenHighlights}
            theme={readingSettings.theme}
          />
          <ToolbarIconButton
            buttonRef={notesTriggerRef}
            icon={<NotebookTabs className="h-[18px] w-[18px] stroke-[1.75]" />}
            active={annotationsOpen && annotationsTab === "notes"}
            label="Notes"
            onClick={onOpenNotes}
            theme={readingSettings.theme}
          />
        </div>
      </div>

      <div
        className={[
          "absolute left-1/2 top-3 flex h-11 max-w-[40vw] -translate-x-1/2 items-center px-4",
          darkTheme ? "text-white/60" : "text-black/60",
        ].join(" ")}
      >
        <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">{title}</span>
      </div>

      <div className="pointer-events-auto absolute right-4 top-3 flex items-center">
        <div ref={translationClusterRef} className={clusterClassName(darkTheme)}>
          <DisplaySettingsPopover
            disabled={false}
            onUpdate={onUpdateReadingSettings}
            settings={readingSettings}
          />

          <ToolbarIconButton
            buttonRef={translationTriggerRef}
            disabled={!canTranslate}
            icon={<Languages className="h-[18px] w-[18px] stroke-[1.75]" />}
            active={translationOpen}
            label="Translate book"
            onClick={onToggleTranslation}
            theme={readingSettings.theme}
          />

          {showBilingualToggle ? (
            <button
              type="button"
              onClick={onToggleBilingualMode}
              className={[
                "h-9 rounded-full px-3 text-[13px] font-medium transition-colors",
                darkTheme
                  ? "text-white/70 hover:bg-white/[0.08] hover:text-white/95"
                  : "text-black/65 hover:bg-black/[0.05] hover:text-black/85",
              ].join(" ")}
            >
              Bilingual
            </button>
          ) : null}

          {canExport ? (
            <ToolbarIconButton
              icon={<Download className="h-[18px] w-[18px] stroke-[1.75]" />}
              label="Export bilingual ePub"
              onClick={onExport}
              theme={readingSettings.theme}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
