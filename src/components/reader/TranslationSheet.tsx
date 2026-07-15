import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

import { ReaderSelect } from "@/components/reader/ReaderSelect";
import { Button } from "@/components/ui/button";
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
}

const PANEL_MAX_WIDTH_PX = 320;
const PANEL_VIEWPORT_PADDING_PX = 16;
const PANEL_VERTICAL_OFFSET_PX = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolvePanelPosition({
  anchorElement,
  clusterElement,
  viewportWidth,
}: Pick<TranslationSheetProps, "anchorElement" | "clusterElement"> & {
  viewportWidth: number;
}) {
  const panelWidth = Math.min(
    PANEL_MAX_WIDTH_PX,
    Math.max(320, viewportWidth - PANEL_VIEWPORT_PADDING_PX * 2),
  );
  const anchorRect = anchorElement?.getBoundingClientRect() ?? null;
  const clusterRect = clusterElement?.getBoundingClientRect() ?? anchorRect;
  const panelCenterX = clusterRect
    ? clusterRect.left + clusterRect.width / 2
    : anchorRect
      ? anchorRect.left + anchorRect.width / 2
      : viewportWidth - PANEL_VIEWPORT_PADDING_PX - panelWidth / 2;
  const left = clamp(
    panelCenterX - panelWidth / 2,
    PANEL_VIEWPORT_PADDING_PX,
    viewportWidth - PANEL_VIEWPORT_PADDING_PX - panelWidth,
  );
  const top = (clusterRect?.bottom ?? anchorRect?.bottom ?? 64) + PANEL_VERTICAL_OFFSET_PX;

  return {
    left,
    top,
    width: panelWidth,
  };
}

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
}: TranslationSheetProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage ?? "");

  useEffect(() => {
    setSelectedLanguage(currentLanguage ?? "");
  }, [currentLanguage, open]);

  const isAlreadyComplete =
    Boolean(job) &&
    job?.target_language === selectedLanguage &&
    job.status === "complete" &&
    job.completed_paragraphs >= job.total_paragraphs;

  const [panelPosition, setPanelPosition] = useState(() =>
    resolvePanelPosition({
      anchorElement: null,
      clusterElement: null,
      viewportWidth: typeof window === "undefined" ? 1440 : window.innerWidth,
    }),
  );

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    let animationFrameId = 0;

    const updatePosition = () => {
      setPanelPosition(
        resolvePanelPosition({
          anchorElement,
          clusterElement,
          viewportWidth: window.innerWidth,
        }),
      );
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(updatePosition);
    };

    updatePosition();
    scheduleUpdate();

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);

    if (anchorElement) {
      resizeObserver?.observe(anchorElement);
    }

    if (clusterElement && clusterElement !== anchorElement) {
      resizeObserver?.observe(clusterElement);
    }

    window.addEventListener("resize", scheduleUpdate);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [anchorElement, clusterElement, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40" onMouseDown={() => onOpenChange(false)}>
      <div
        className="absolute"
        style={{
          left: panelPosition.left,
          top: panelPosition.top,
          width: panelPosition.width,
        }}
      >
        <div
          className="animate-fade-in pointer-events-auto relative w-full"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="rounded-[12px] border border-black/[0.08] bg-white/95 p-4 text-black shadow-popup backdrop-blur-2xl">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/40">
                  Translate Book
                </p>
                <p className="text-[12px] leading-5 text-black/45">
                  Original text remains visible alongside the translation. This may use
                  API credits.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-black/40"
                  htmlFor="translation-language"
                >
                  Translate To
                </label>
                <ReaderSelect
                  ariaLabel="Translate to"
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
                <p className="rounded-[8px] border border-black/[0.08] bg-black/[0.03] px-3 py-2 text-[12px] leading-5 text-black/55">
                  This book has already been translated to {selectedLanguage}. Starting
                  again will replace the existing version.
                </p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-[8px] border border-[#ff3b3026] bg-[#ff3b3010] px-3 py-2 text-[12px] leading-5 text-[#c53929]">
                  {errorMessage}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 rounded-[7px] border border-black/[0.08] bg-black/[0.04] px-3 text-[13px] font-medium text-black/65 hover:bg-black/[0.07] hover:text-black/85"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-8 min-w-[132px] rounded-[7px] bg-black px-4 text-[13px] font-medium text-white hover:bg-black/85 disabled:bg-black/20 disabled:text-white/80"
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
