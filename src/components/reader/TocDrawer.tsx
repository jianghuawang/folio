import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeTocHref, type ReaderTocItem } from "@/lib/epub-bridge";

const PANEL_VERTICAL_OFFSET_PX = 10;
const PANEL_VIEWPORT_PADDING_PX = 16;
const TOC_PANEL_MAX_WIDTH_PX = 340;

const TOC_INDENT_CLASS_NAMES = {
  0: "pl-2.5",
  1: "pl-6",
  2: "pl-9",
  3: "pl-12",
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

  return {
    left,
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
          className="animate-fade-in pointer-events-auto relative w-full"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="overflow-hidden rounded-[12px] border border-black/[0.08] bg-white/95 text-black shadow-popup backdrop-blur-2xl">
            <div className="px-4 pb-1 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/40">
                Contents
              </p>
            </div>

            {items.length === 0 ? (
              <div className="px-4 pb-5 pt-2 text-[13px] text-black/45">
                This book has no table of contents.
              </div>
            ) : (
              <div className="max-h-[60vh] space-y-0.5 overflow-y-auto p-2">
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
                        "flex w-full items-center rounded-[8px] px-2.5 py-2 text-left text-[13px] transition-colors",
                        TOC_INDENT_CLASS_NAMES[cappedDepth],
                        isTopLevel ? "font-semibold" : "font-normal",
                        isActive
                          ? "bg-black/[0.07] text-black"
                          : "text-black/75 hover:bg-black/[0.05] hover:text-black",
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
