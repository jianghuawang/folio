import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

import { ReaderSelect } from "@/components/reader/ReaderSelect";
import { Button } from "@/components/ui/button";
import { useAnchoredPanel } from "@/hooks/useAnchoredPanel";
import {
  controlSurface,
  errorBox,
  ghostControl,
  panelAnimation,
  panelHeading,
  panelNotch,
  panelSurface,
  resolveChromeTheme,
  Z,
} from "@/lib/panel-chrome";
import type { ReadingTheme } from "@/types/settings";
import type { TranslationJob } from "@/types/translation";

interface TranslationSheetProps {
  anchorElement: HTMLElement | null;
  availableLanguages: readonly string[];
  clusterElement: HTMLElement | null;
  currentLanguage: string | null;
  errorMessage?: string | null;
  job: TranslationJob | null;
  onOpenChange: (open: boolean) => void;
  onStart: (language: string, replaceExisting?: boolean) => Promise<void>;
  open: boolean;
  pending: boolean;
  theme?: ReadingTheme;
}

const PANEL_MAX_WIDTH_PX = 320;

export function TranslationSheet({
  anchorElement,
  availableLanguages,
  clusterElement,
  currentLanguage,
  errorMessage = null,
  job,
  onOpenChange,
  onStart,
  open,
  pending,
  theme = "light",
}: TranslationSheetProps) {
  const chromeTheme = resolveChromeTheme(theme);
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage ?? "");

  useEffect(() => {
    setSelectedLanguage(currentLanguage ?? "");
  }, [currentLanguage, open]);

  const isAlreadyComplete =
    Boolean(job) &&
    job?.target_language === selectedLanguage &&
    job.status === "complete" &&
    job.completed_paragraphs >= job.total_paragraphs;

  const panelPosition = useAnchoredPanel({
    anchorElement,
    clusterElement,
    maxWidth: PANEL_MAX_WIDTH_PX,
    open,
  });

  if (!open) {
    return null;
  }

  return createPortal(
    <div className={`fixed inset-0 ${Z.panel}`} onMouseDown={() => onOpenChange(false)}>
      <div
        className="absolute"
        style={{
          left: panelPosition.left,
          top: panelPosition.top,
          width: panelPosition.width,
        }}
      >
        <div
          className={`${panelAnimation} pointer-events-auto relative w-full`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className={panelNotch(chromeTheme)} style={{ left: panelPosition.notchLeft }} />

          <div className={`p-4 ${panelSurface(chromeTheme)}`}>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className={panelHeading(chromeTheme)}>Translate Book</p>
                <p
                  className={`text-[12px] leading-5 ${
                    chromeTheme === "dark" ? "text-white/45" : "text-black/45"
                  }`}
                >
                  Original text remains visible alongside the translation. This may use
                  API credits.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  className={`block ${panelHeading(chromeTheme)}`}
                  htmlFor="translation-language"
                >
                  Translate To
                </label>
                <ReaderSelect
                  ariaLabel="Translate to"
                  darkTheme={chromeTheme === "dark"}
                  id="translation-language"
                  placeholder="Select language"
                  options={availableLanguages.map((language) => ({
                    label: language,
                    value: language,
                  }))}
                  value={selectedLanguage}
                  onChange={setSelectedLanguage}
                />
              </div>

              {isAlreadyComplete ? (
                <p
                  className={`rounded-md px-3 py-2 text-[12px] leading-5 ${controlSurface(chromeTheme)} ${
                    chromeTheme === "dark" ? "text-white/55" : "text-black/55"
                  }`}
                >
                  This book has already been translated to {selectedLanguage}. Starting
                  again will replace the existing version.
                </p>
              ) : null}

              {errorMessage ? (
                <p className={`px-3 py-2 text-[12px] leading-5 ${errorBox(chromeTheme)}`}>
                  {errorMessage}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-8 rounded-md px-3 text-[13px] font-medium ${controlSurface(chromeTheme)} ${ghostControl(chromeTheme)}`}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-8 min-w-[132px] rounded-md bg-black px-4 text-[13px] font-medium text-white hover:bg-black/85 disabled:bg-black/20 disabled:text-white/80"
                  disabled={!selectedLanguage || pending}
                  onClick={() => void onStart(selectedLanguage, isAlreadyComplete)}
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isAlreadyComplete ? (
                    "Re-translate"
                  ) : (
                    "Start Translation"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
