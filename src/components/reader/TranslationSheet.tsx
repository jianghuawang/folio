import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2 } from "lucide-react";

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

const PANEL_MAX_WIDTH_PX = 420;
const PANEL_VIEWPORT_PADDING_PX = 16;
const PANEL_VERTICAL_OFFSET_PX = 18;
const NOTCH_SIZE_PX = 24;
const NOTCH_HORIZONTAL_PADDING_PX = 28;

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
  const notchTargetX = anchorRect
    ? anchorRect.left + anchorRect.width / 2
    : clusterRect
      ? clusterRect.left + clusterRect.width / 2
      : panelCenterX;
  const notchCenterX = clamp(
    notchTargetX - left,
    NOTCH_HORIZONTAL_PADDING_PX,
    panelWidth - NOTCH_HORIZONTAL_PADDING_PX,
  );

  return {
    left,
    notchLeft: notchCenterX - NOTCH_SIZE_PX / 2,
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
          className="pointer-events-auto relative w-full origin-top-right animate-in zoom-in-95 duration-[160ms] ease-out"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            className="absolute top-0 h-6 w-6 -translate-y-1/2 rotate-45 border-l border-t border-black/10 bg-white/88"
            style={{ left: panelPosition.notchLeft }}
          />

          <div className="overflow-hidden rounded-[34px] border border-black/10 bg-white/92 text-black shadow-[0_30px_90px_rgba(0,0,0,0.18)] backdrop-blur-[28px]">
            <div className="border-b border-black/10 px-6 py-5">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-black/70">
                Translate Book
              </h2>
              <p className="mt-1 text-sm leading-6 text-black/45">
                Original text remains visible alongside the translation. This may use
                API credits.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-[28px] border border-black/10 bg-white/66 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <label
                  className="text-sm font-medium text-black/50"
                  htmlFor="translation-language"
                >
                  Translate to
                </label>

                <div className="relative mt-3">
                  <select
                    id="translation-language"
                    value={selectedLanguage}
                    onChange={(event) => setSelectedLanguage(event.target.value)}
                    className="h-14 w-full appearance-none rounded-full border border-black/10 bg-white px-5 pr-12 text-[16px] font-medium text-black [color-scheme:light] outline-none transition focus:border-black/20 focus:bg-white"
                  >
                    <option value="">Select language</option>
                    {availableLanguages.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
                </div>
              </div>

              {isAlreadyComplete ? (
                <p className="rounded-[22px] border border-black/10 bg-black/[0.03] px-4 py-3 text-sm leading-6 text-black/55">
                  This book has already been translated to {selectedLanguage}. Starting
                  again will replace the existing version.
                </p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-[22px] border border-[#ff3b3026] bg-[#ff3b3010] px-4 py-3 text-sm leading-6 text-[#c53929]">
                  {errorMessage}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-black/10 px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-black/10 bg-white/70 px-5 text-black/55 hover:bg-white hover:text-black/70"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="min-w-[182px] rounded-full bg-black px-6 text-white hover:bg-black/85 disabled:bg-black/20 disabled:text-white/80"
                disabled={!selectedLanguage || pending}
                onClick={() => void onStart(selectedLanguage, isAlreadyComplete)}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
    </div>,
    document.body,
  );
}
