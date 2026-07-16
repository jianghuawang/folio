import { createPortal } from "react-dom";
import { normalizeTocHref, type ReaderTocItem } from "@/lib/epub-bridge";
import { useAnchoredPanel } from "@/hooks/useAnchoredPanel";
import {
  listRowActive,
  listRowHover,
  panelAnimation,
  panelHeading,
  panelMuted,
  panelNotch,
  panelSurface,
  resolveChromeTheme,
  Z,
} from "@/lib/panel-chrome";
import type { ReadingTheme } from "@/types/settings";

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
  theme?: ReadingTheme;
}

export function TocDrawer({
  anchorElement,
  clusterElement,
  currentHref,
  items,
  open,
  onOpenChange,
  onSelect,
  theme = "light",
}: TocDrawerProps) {
  const chromeTheme = resolveChromeTheme(theme);
  const normalizedCurrentHref = normalizeTocHref(currentHref);
  const panelPosition = useAnchoredPanel({
    anchorElement,
    clusterElement,
    maxWidth: TOC_PANEL_MAX_WIDTH_PX,
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

          <div className={`overflow-hidden ${panelSurface(chromeTheme)}`}>
            <div className="px-4 pb-1 pt-4">
              <p className={panelHeading(chromeTheme)}>Contents</p>
            </div>

            {items.length === 0 ? (
              <div className={`px-4 pb-5 pt-2 ${panelMuted(chromeTheme)}`}>
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
                        "flex w-full items-center rounded-md px-2.5 py-2 text-left text-[13px] transition-colors",
                        TOC_INDENT_CLASS_NAMES[cappedDepth],
                        isTopLevel ? "font-semibold" : "font-normal",
                        isActive
                          ? listRowActive(chromeTheme)
                          : chromeTheme === "dark"
                            ? `text-white/75 hover:text-white ${listRowHover(chromeTheme)}`
                            : `text-black/75 hover:text-black ${listRowHover(chromeTheme)}`,
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
