import { createPortal } from "react-dom";
import { normalizeTocHref, type ReaderTocItem } from "@/lib/epub-bridge";

const TOC_INDENT_CLASS_NAMES = {
  0: "pl-4",
  1: "pl-8",
  2: "pl-12",
  3: "pl-16",
} as const;

interface TocDrawerProps {
  currentHref: string;
  items: ReaderTocItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (href: string) => void;
}

export function TocDrawer({
  currentHref,
  items,
  open,
  onOpenChange,
  onSelect,
}: TocDrawerProps) {
  const normalizedCurrentHref = normalizeTocHref(currentHref);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40" onMouseDown={() => onOpenChange(false)}>
      <div className="absolute left-5 right-4 top-20 flex justify-start">
        <div
          className="pointer-events-auto relative w-full max-w-[604px]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="absolute left-[68px] top-0 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-black/10 bg-white/88" />

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
