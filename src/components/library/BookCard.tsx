import { useCallback, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { MoreHorizontal } from "lucide-react";

import { hashStringToColor } from "@/lib/utils";
import type { Book } from "@/types/book";

interface BookCardProps {
  book: Book;
  onOpen: (bookId: string) => void;
  onContextMenu: (book: Book, x: number, y: number) => void;
  /** Stagger delay in ms for entrance animation */
  animationDelay?: number;
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

export function BookCard({ book, onOpen, onContextMenu, animationDelay = 0 }: BookCardProps) {
  const badge = getBadge(book);
  const coverImageSrc = book.cover_image_path ? convertFileSrc(book.cover_image_path) : null;
  const placeholderColor = hashStringToColor(book.title);
  const coverRef = useRef<HTMLButtonElement>(null);

  const handleOpen = useCallback(() => {
    const el = coverRef.current;
    if (el) {
      el.classList.add("animate-book-press");
      el.addEventListener(
        "animationend",
        () => {
          el.classList.remove("animate-book-press");
          onOpen(book.id);
        },
        { once: true },
      );
    } else {
      onOpen(book.id);
    }
  }, [book.id, onOpen]);

  return (
    <article
      className="animate-book-card-in group w-[160px] cursor-default select-none"
      style={{ animationDelay: `${animationDelay}ms` }}
      onDoubleClick={handleOpen}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(book, event.clientX, event.clientY);
      }}
    >
      {/* Book cover */}
      <button
        ref={coverRef}
        type="button"
        onClick={handleOpen}
        className="relative block h-[220px] w-[160px] cursor-pointer overflow-hidden rounded-[5px] bg-[--color-bg-surface] text-left shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(0,0,0,0.5)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e1e1e]"
        style={{ transitionTimingFunction: "var(--ease-spring)" }}
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

      {/* Meta row: progress / ... / NEW — matches macOS Books layout */}
      <div className="mt-2 flex h-5 items-center justify-between px-0.5">
        {/* Left: progress percentage */}
        <span className="min-w-[28px] text-[11px] text-white/30">
          {badge?.kind === "progress" ? badge.label : ""}
        </span>

        {/* Center: three-dot menu — always visible */}
        <button
          type="button"
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors hover:text-white/60"
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            onContextMenu(book, rect.left + rect.width / 2, rect.bottom + 6);
          }}
          aria-label={`More actions for ${book.title}`}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>

        {/* Right: NEW badge — plain text, not a pill */}
        <span className="min-w-[28px] text-right text-[11px] font-medium text-white/30">
          {badge?.kind === "new" ? badge.label : ""}
        </span>
      </div>

      {/* Title and author */}
      <div className="mt-0.5 space-y-0.5 px-0.5">
        <p className="line-clamp-2 text-[12px] font-normal leading-[1.3] text-white/80">
          {book.title}
        </p>
        <p className="truncate text-[11px] text-white/30">{book.author}</p>
      </div>
    </article>
  );
}
