import { convertFileSrc } from "@tauri-apps/api/core";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useBook } from "@/hooks/useBook";
import { hashStringToColor } from "@/lib/utils";

interface BookInfoSheetProps {
  bookId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[--color-text-section]">
        {label}
      </dt>
      <dd className="break-words text-sm text-[--color-text-primary]">{value}</dd>
    </div>
  );
}

export function BookInfoSheet({ bookId, open, onOpenChange }: BookInfoSheetProps) {
  const { data: book, error, isLoading, refetch } = useBook(open ? bookId : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-l border-[--color-border] bg-[--color-bg-surface] p-6 text-[--color-text-primary] sm:max-w-[360px]"
      >
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-[22px] font-semibold text-[--color-text-primary]">
            Book Info
          </SheetTitle>
          <SheetDescription className="text-sm text-[--color-text-muted]">
            Read-only metadata for the managed Folio copy.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[180px] w-[132px] bg-white/10" />
              <Skeleton className="h-4 w-3/4 bg-white/10" />
              <Skeleton className="h-4 w-1/2 bg-white/5" />
              <Skeleton className="h-20 w-full bg-white/5" />
            </div>
          ) : error ? (
            <div className="space-y-3 rounded-xl border border-[--color-border] bg-[--color-bg-elevated] p-4">
              <p className="text-sm text-[--color-destructive]">Failed to load book details.</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="text-sm text-[--color-primary] underline underline-offset-4"
              >
                Retry
              </button>
            </div>
          ) : book ? (
            <div className="space-y-6">
              <div className="overflow-hidden">
                {book.cover_image_path ? (
                  <img
                    src={convertFileSrc(book.cover_image_path)}
                    alt={`Cover for ${book.title}`}
                    className="h-[180px] w-[132px] object-cover shadow-sm"
                  />
                ) : (
                  <div
                    className="flex h-[180px] w-[132px] items-center justify-center text-4xl font-semibold text-white shadow-sm"
                    style={{ backgroundColor: hashStringToColor(book.title) }}
                  >
                    {book.title.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                )}
              </div>

              <dl className="space-y-4">
                <MetadataRow label="Title" value={book.title} />
                <MetadataRow label="Author" value={book.author} />
                <MetadataRow
                  label="Added"
                  value={new Date(book.added_at * 1000).toLocaleString()}
                />
                <MetadataRow label="Managed File" value={book.file_path} />
              </dl>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
