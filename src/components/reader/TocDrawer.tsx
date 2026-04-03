import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full border-r border-black/10 bg-white/95 p-0 text-black shadow-[0_22px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl [&>button]:hidden sm:max-w-[280px]"
      >
        <div className="h-full overflow-y-auto">
          <SheetHeader className="border-b border-black/10 px-5 pb-4 pt-5 text-center">
            <SheetTitle className="text-[19px] font-semibold tracking-[-0.02em] text-black/60">
              Contents
            </SheetTitle>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="px-5 py-6 text-sm text-black/45">
              This book has no table of contents.
            </div>
          ) : (
            <div className="px-3 py-4">
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
                      "flex w-full items-center rounded-full px-4 py-2.5 text-left transition-colors",
                      TOC_INDENT_CLASS_NAMES[cappedDepth],
                      isTopLevel
                        ? "text-[15px] font-semibold tracking-[-0.02em]"
                        : "text-[14px] font-medium",
                      isActive
                        ? "bg-[--color-primary]/14 text-[--color-primary]"
                        : "text-black/78 hover:bg-black/[0.04] hover:text-black/92",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
