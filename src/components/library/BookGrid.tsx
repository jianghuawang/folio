import { Skeleton } from "@/components/ui/skeleton";
import type { Book } from "@/types/book";

import { BookCard } from "./BookCard";

interface BookGridProps {
  books: Book[];
  isLoading?: boolean;
  onOpen: (bookId: string) => void;
  onContextMenu: (book: Book, x: number, y: number) => void;
}

/** Max stagger delay so large libraries don't wait forever */
const MAX_STAGGER_MS = 600;
const STAGGER_STEP_MS = 40;

function BookCardSkeleton({ index }: { index: number }) {
  return (
    <div className="w-[160px] space-y-1.5" key={index}>
      <Skeleton className="h-[220px] w-[160px] rounded-[5px] bg-white/8" />
      <Skeleton className="h-3 w-full bg-white/5" />
      <Skeleton className="h-3 w-4/5 bg-white/5" />
      <Skeleton className="h-2.5 w-3/5 bg-white/[0.03]" />
    </div>
  );
}

export function BookGrid({ books, isLoading = false, onOpen, onContextMenu }: BookGridProps) {
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(160px,1fr))] justify-items-start gap-x-8 gap-y-12">
      {isLoading
        ? Array.from({ length: 8 }, (_, index) => <BookCardSkeleton key={index} index={index} />)
        : books.map((book, index) => (
            <BookCard
              key={book.id}
              book={book}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
              animationDelay={Math.min(index * STAGGER_STEP_MS, MAX_STAGGER_MS)}
            />
          ))}
    </div>
  );
}
