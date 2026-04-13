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
      className="group w-[160px] cursor-default select-none"
      onDoubleClick={() => onOpen(book.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(book, event.clientX, event.clientY);
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(book.id)}
        className="block h-[220px] w-[160px] cursor-pointer overflow-hidden bg-[--color-bg-surface] text-left shadow-[0_10px_24px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg-content]"
        aria-label={`Open ${book.title}`}
      >
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
      </button>

      <div className="mt-3 space-y-1">
        <p className="line-clamp-2 text-[14px] font-medium leading-[1.35] text-white/96">
          {book.title}
        </p>
        <p className="truncate text-[12px] text-white/46">{book.author}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          {badge ? (
            badge.kind === "new" ? (
              <span className="inline-flex rounded-full bg-[--color-primary] px-2 py-1 text-[11px] font-semibold leading-none text-white shadow-[0_4px_12px_rgba(10,132,255,0.22)]">
                {badge.label}
              </span>
            ) : (
              <span className="text-[12px] text-white/42">{badge.label}</span>
            )
          ) : (
            <span className="h-4" />
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-white/28 opacity-0 transition hover:bg-white/[0.08] hover:text-white/72 group-hover:opacity-100"
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
