import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { normalizeTocHref, type ReaderTocItem } from "@/lib/epub-bridge";

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
        className="w-full border-r border-[--color-border] bg-[--color-bg-surface] p-0 text-[--color-text-primary] sm:max-w-[280px]"
      >
        <div className="h-full overflow-y-auto">
          <SheetHeader className="border-b border-[--color-border] px-6 py-5">
            <SheetTitle className="text-[22px] font-semibold text-[--color-text-primary]">
              Table of Contents
            </SheetTitle>
            <SheetDescription className="text-sm text-[--color-text-muted]">
              Jump directly to any chapter.
            </SheetDescription>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="px-6 py-6 text-sm text-[--color-text-muted]">
              This book has no table of contents.
            </div>
          ) : (
            <div className="px-3 py-4">
              {items.map((item) => {
                const isActive = normalizeTocHref(item.href) === normalizedCurrentHref;

                return (
                  <button
                    key={`${item.id}-${item.href}`}
                    type="button"
                    onClick={() => onSelect(item.href)}
                    className={[
                      "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "bg-[--color-primary]/15 text-[--color-primary]"
                        : "text-[--color-text-secondary] hover:bg-white/5 hover:text-[--color-text-primary]",
                    ].join(" ")}
                    style={{ paddingLeft: `${12 + Math.min(item.depth, 3) * 16}px` }}
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
