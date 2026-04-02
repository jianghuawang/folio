import { convertFileSrc } from "@tauri-apps/api/core";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hashStringToColor } from "@/lib/utils";
import type { Book } from "@/types/book";

interface BookCardProps {
  book: Book;
  onOpen: (bookId: string) => void;
  onContextMenu: (book: Book, x: number, y: number) => void;
}

function getBadge(book: Book): { label: string; kind: "new" | "progress" } | null {
  if (book.reading_progress > 0 && book.reading_progress < 1) {
    return {
      label: `${Math.round(book.reading_progress * 100)}%`,
      kind: "progress",
    };
  }

  if (book.last_read_at === null && book.reading_progress === 0) {
    return {
      label: "NEW",
      kind: "new",
    };
  }

  return null;
}

export function BookCard({ book, onOpen, onContextMenu }: BookCardProps) {
  const badge = getBadge(book);
  const coverImageSrc = book.cover_image_path ? convertFileSrc(book.cover_image_path) : null;
  const placeholderColor = hashStringToColor(book.title);

  return (
    <article
      className="group w-full max-w-[160px] cursor-default select-none"
      onDoubleClick={() => onOpen(book.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(book, event.clientX, event.clientY);
      }}
    >
      <div className="h-[220px] w-[160px] overflow-hidden bg-[--color-bg-surface] shadow-sm">
        {coverImageSrc ? (
          <img
            src={coverImageSrc}
            alt={`Cover for ${book.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[52px] font-semibold text-white"
            style={{ backgroundColor: placeholderColor }}
          >
            {book.title.trim().charAt(0).toUpperCase() || "?"}
          </div>
        )}
      </div>

      <div className="mt-2 space-y-1">
        <p className="line-clamp-2 text-[13px] text-[--color-text-primary]">{book.title}</p>
        <p className="truncate text-[11px] text-[--color-text-muted]">{book.author}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          {badge ? (
            badge.kind === "new" ? (
              <span className="inline-flex rounded-full bg-[--color-primary] px-2 py-1 text-[11px] font-semibold leading-none text-white">
                {badge.label}
              </span>
            ) : (
              <span className="text-[12px] text-[--color-text-muted]">{badge.label}</span>
            )
          ) : (
            <span className="h-4" />
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-[--color-text-muted] opacity-0 transition hover:bg-white/10 hover:text-[--color-text-primary] group-hover:opacity-100"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onContextMenu(book, rect.left + rect.width / 2, rect.bottom + 6);
            }}
            aria-label={`Open actions for ${book.title}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
