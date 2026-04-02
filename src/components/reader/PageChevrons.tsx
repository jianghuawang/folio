import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PageChevronsProps {
  disabled?: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export function PageChevrons({ disabled = false, onNext, onPrev }: PageChevronsProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onPrev}
          className="pointer-events-auto h-10 w-10 rounded-full bg-[--color-bg-surface]/85 text-[--color-text-primary] opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-[--color-bg-elevated]"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onNext}
          className="pointer-events-auto h-10 w-10 rounded-full bg-[--color-bg-surface]/85 text-[--color-text-primary] opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-[--color-bg-elevated]"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </>
  );
}
