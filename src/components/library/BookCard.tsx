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
  const openingRef = useRef(false);

  const handleOpen = useCallback(() => {
    if (openingRef.current) {
      return;
    }

    openingRef.current = true;
    const el = coverRef.current;
    if (el) {
      let completed = false;
      const finishOpen = () => {
        if (completed) {
          return;
        }

        completed = true;
        window.clearTimeout(fallbackTimer);
        el.removeEventListener("animationend", finishOpen);
        el.classList.remove("animate-book-press");
        onOpen(book.id);
      };
      const fallbackTimer = window.setTimeout(finishOpen, 500);
      el.addEventListener("animationend", finishOpen, { once: true });
      el.classList.add("animate-book-press");
    } else {
      onOpen(book.id);
    }
  }, [book.id, onOpen]);

  return (
    <article
      className="animate-book-card-in group w-[160px] cursor-default select-none"
      style={{ animationDelay: `${animationDelay}ms` }}
      onDoubleClick={(event) => {
        if (!(event.target as HTMLElement).closest("[data-book-actions]")) {
          handleOpen();
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(book, event.clientX, event.clientY);
      }}
    >
      {/* Book cover */}
      <button
        ref={coverRef}
        type="button"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleOpen();
          }
        }}
        className="relative block h-[220px] w-[160px] cursor-pointer overflow-hidden rounded-[4px] bg-[--color-bg-surface] text-left shadow-[0_1px_2px_rgba(0,0,0,0.35),0_6px_16px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_2px_4px_rgba(0,0,0,0.35),0_14px_28px_rgba(0,0,0,0.45)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e1e1e]"
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
            className="flex h-full w-full flex-col justify-between p-3.5"
            style={{
              backgroundColor: placeholderColor,
              backgroundImage:
                "linear-gradient(155deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.22) 100%)",
            }}
          >
            <p
              className="line-clamp-5 text-[15px] font-semibold leading-[1.3] text-white/95 [text-wrap:balance]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {book.title}
            </p>
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-white/60">
              {book.author}
            </p>
          </div>
        )}

        {/* Paperback edge treatment: hairline + inner spine highlight */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[4px] ring-1 ring-inset ring-white/[0.12]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-[6px] bg-gradient-to-r from-black/25 via-white/10 to-transparent"
        />
      </button>

      {/* Meta row: progress / ... / NEW — matches macOS Books layout */}
      <div className="mt-2 flex h-5 items-center justify-between px-0.5">
        {/* Left: progress percentage */}
        <span className="min-w-[28px] text-[11px] tabular-nums text-white/35">
          {badge?.kind === "progress" ? badge.label : ""}
        </span>

        {/* Center: three-dot menu — revealed on hover, like Books */}
        <button
          data-book-actions="true"
          type="button"
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-white/40 opacity-0 transition-opacity duration-150 hover:text-white/75 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0a84ff]/80 group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            onContextMenu(book, rect.left + rect.width / 2, rect.bottom + 6);
          }}
          aria-label={`More actions for ${book.title}`}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>

        {/* Right: NEW badge */}
        <span className="min-w-[28px] text-right text-[10px] font-semibold tracking-[0.05em] text-[#0a84ff]/90">
          {badge?.kind === "new" ? badge.label : ""}
        </span>
      </div>

      {/* Title and author */}
      <div className="mt-0.5 space-y-0.5 px-0.5">
        <p className="line-clamp-2 text-[12px] font-normal leading-[1.3] text-white/85">
          {book.title}
        </p>
        <p className="truncate text-[11px] text-white/40">{book.author}</p>
      </div>
    </article>
  );
}
