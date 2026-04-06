import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeTocHref, type ReaderTocItem } from "@/lib/epub-bridge";

const NOTCH_HORIZONTAL_PADDING_PX = 28;
const NOTCH_SIZE_PX = 24;
const PANEL_VERTICAL_OFFSET_PX = 18;
const PANEL_VIEWPORT_PADDING_PX = 16;
const TOC_PANEL_MAX_WIDTH_PX = 440;

const TOC_INDENT_CLASS_NAMES = {
  0: "pl-4",
  1: "pl-8",
  2: "pl-12",
  3: "pl-16",
} as const;

interface TocDrawerProps {
  anchorElement: HTMLElement | null;
  clusterElement: HTMLElement | null;
  currentHref: string;
  items: ReaderTocItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (href: string) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolvePanelPosition({
  anchorElement,
  clusterElement,
  viewportWidth,
}: Pick<TocDrawerProps, "anchorElement" | "clusterElement"> & {
  viewportWidth: number;
}) {
  const panelWidth = Math.min(
    TOC_PANEL_MAX_WIDTH_PX,
    Math.max(320, viewportWidth - PANEL_VIEWPORT_PADDING_PX * 2),
  );
  const anchorRect = anchorElement?.getBoundingClientRect() ?? null;
  const clusterRect = clusterElement?.getBoundingClientRect() ?? anchorRect;
  const panelCenterX = clusterRect
    ? clusterRect.left + clusterRect.width / 2
    : anchorRect
      ? anchorRect.left + anchorRect.width / 2
      : PANEL_VIEWPORT_PADDING_PX + panelWidth / 2;
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

export function TocDrawer({
  anchorElement,
  clusterElement,
  currentHref,
  items,
  open,
  onOpenChange,
  onSelect,
}: TocDrawerProps) {
  const normalizedCurrentHref = normalizeTocHref(currentHref);
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
          className="pointer-events-auto relative w-full origin-top-left animate-in zoom-in-95 duration-[160ms] ease-out"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            className="absolute top-0 h-6 w-6 -translate-y-1/2 rotate-45 border-l border-t border-black/10 bg-white/88"
            style={{ left: panelPosition.notchLeft }}
          />

          <div className="overflow-hidden rounded-[34px] border border-black/10 bg-white/84 text-black shadow-[0_30px_90px_rgba(0,0,0,0.18)] backdrop-blur-[28px]">
            <div className="border-b border-black/10 px-6 py-5 text-center">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-black/55">
                Contents
              </h2>
            </div>

            {items.length === 0 ? (
              <div className="px-6 py-8 text-sm text-black/45">
                This book has no table of contents.
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
                {items.map((item) => {
                  const isActive = normalizeTocHref(item.href) === normalizedCurrentHref;
                  const cappedDepth = Math.min(item.depth, 3) as keyof typeof TOC_INDENT_CLASS_NAMES;
                  const isTopLevel = item.depth === 0;

                  return (
                    <button
                      key={`${item.id}-${item.href}`}
                      type="button"
                      onClick={() => onSelect(item.href)}
                      className={[
                        "flex w-full items-center rounded-[22px] px-5 py-3 text-left transition-colors",
                        TOC_INDENT_CLASS_NAMES[cappedDepth],
                        isTopLevel
                          ? "text-[15px] font-semibold tracking-[-0.02em]"
                          : "text-[14px] font-medium",
                        isActive
                          ? "bg-black/10 text-black"
                          : "text-black/80 hover:bg-black/[0.05] hover:text-black",
                      ].join(" ")}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
