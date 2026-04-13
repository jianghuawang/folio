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
        "h-10 w-10 rounded-full disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? darkTheme
            ? "bg-white/[0.1] text-white"
            : "bg-black/10 text-black"
          : darkTheme
            ? "text-white/72 hover:bg-white/[0.07] hover:text-white/92"
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
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-3">
      <div className="pointer-events-auto absolute left-5 top-5 flex items-center">
        <div
          ref={leftClusterRef}
          className={[
            "flex items-center gap-1 rounded-full p-1.5 backdrop-blur-[24px]",
            darkTheme
              ? "border border-white/[0.08] bg-[#323235]/88 shadow-[0_18px_48px_rgba(0,0,0,0.34)]"
              : "border border-black/5 bg-white/88 shadow-[0_18px_48px_rgba(0,0,0,0.16)]",
          ].join(" ")}
        >
          <ToolbarIconButton
            buttonRef={tocTriggerRef}
            icon={<Menu className="h-5 w-5 stroke-[1.75]" />}
            active={tocOpen}
            label="Contents"
            onClick={onToggleToc}
            theme={readingSettings.theme}
          />
          <ToolbarIconButton
            buttonRef={highlightsTriggerRef}
            icon={<Bookmark className="h-5 w-5 stroke-[1.75]" />}
            active={annotationsOpen && annotationsTab === "highlights"}
            label="Highlights"
            onClick={onOpenHighlights}
            theme={readingSettings.theme}
          />
          <ToolbarIconButton
            buttonRef={notesTriggerRef}
            icon={<NotebookTabs className="h-5 w-5 stroke-[1.75]" />}
            active={annotationsOpen && annotationsTab === "notes"}
            label="Notes"
            onClick={onOpenNotes}
            theme={readingSettings.theme}
          />
        </div>
      </div>

      <div
        className={[
          "absolute left-1/2 top-7 max-w-[45vw] -translate-x-1/2 truncate px-4 text-center text-[15px] font-semibold tracking-[-0.02em]",
          darkTheme ? "text-white/78" : "text-black/75",
        ].join(" ")}
      >
        {title}
      </div>

      <div className="pointer-events-auto absolute right-5 top-5 flex items-center">
        <div
          ref={translationClusterRef}
          className={[
            "flex items-center gap-1 rounded-full p-1.5 backdrop-blur-[20px]",
            darkTheme
              ? "border border-white/[0.08] bg-[#323235]/92 shadow-[0_18px_48px_rgba(0,0,0,0.34)]"
              : "border border-[#ece7df] bg-white/92 shadow-[0_18px_48px_rgba(0,0,0,0.14)]",
          ].join(" ")}
        >
          <DisplaySettingsPopover
            disabled={false}
            onUpdate={onUpdateReadingSettings}
            settings={readingSettings}
          />

          <ToolbarIconButton
            buttonRef={translationTriggerRef}
            disabled={!canTranslate}
            icon={<Languages className="h-5 w-5 stroke-[1.75]" />}
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
                "rounded-full px-3 py-2 text-sm font-medium transition",
                darkTheme
                  ? "text-white/78 hover:bg-white/[0.07] hover:text-white/92"
                  : "text-black/70 hover:bg-black/[0.05] hover:text-black/85",
              ].join(" ")}
            >
              Bilingual
            </button>
          ) : null}

          {canExport ? (
            <ToolbarIconButton
              icon={<Download className="h-5 w-5 stroke-[1.75]" />}
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
