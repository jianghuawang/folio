import { Skeleton } from "@/components/ui/skeleton";
import type { Book } from "@/types/book";

import { BookCard } from "./BookCard";

interface BookGridProps {
  books: Book[];
  isLoading?: boolean;
  onOpen: (bookId: string) => void;
  onContextMenu: (book: Book, x: number, y: number) => void;
}

function BookCardSkeleton({ index }: { index: number }) {
  return (
    <div className="w-full max-w-[160px] space-y-2" key={index}>
      <Skeleton className="h-[220px] w-[160px] rounded-none bg-white/10" />
      <Skeleton className="h-3 w-4/5 bg-white/10" />
      <Skeleton className="h-3 w-3/5 bg-white/5" />
      <Skeleton className="h-3 w-12 bg-white/5" />
    </div>
  );
}

export function BookGrid({ books, isLoading = false, onOpen, onContextMenu }: BookGridProps) {
  return (
    <div className="mx-auto grid max-w-[1504px] grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-10">
      {isLoading
        ? Array.from({ length: 8 }, (_, index) => <BookCardSkeleton key={index} index={index} />)
        : books.map((book) => (
            <BookCard key={book.id} book={book} onOpen={onOpen} onContextMenu={onContextMenu} />
          ))}
    </div>
  );
}
