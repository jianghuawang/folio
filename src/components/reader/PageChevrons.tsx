import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PageChevronsProps {
  disabled?: boolean;
  onNext: () => void;
  onPrev: () => void;
  theme?: "light" | "sepia" | "dark";
}

export function PageChevrons({
  disabled = false,
  onNext,
  onPrev,
  theme = "light",
}: PageChevronsProps) {
  const darkTheme = theme === "dark";

  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onPrev}
          className={[
            "pointer-events-auto h-16 w-8 rounded-full bg-transparent px-0 transition-all duration-200",
            darkTheme
              ? "text-white/30 hover:bg-white/[0.03] hover:text-white/62"
              : "text-black/40 hover:bg-black/[0.03] hover:text-black/70",
          ].join(" ")}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-8 w-8 stroke-[1.5]" />
        </Button>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onNext}
          className={[
            "pointer-events-auto h-16 w-8 rounded-full bg-transparent px-0 transition-all duration-200",
            darkTheme
              ? "text-white/30 hover:bg-white/[0.03] hover:text-white/62"
              : "text-black/40 hover:bg-black/[0.03] hover:text-black/70",
          ].join(" ")}
          aria-label="Next page"
        >
          <ChevronRight className="h-8 w-8 stroke-[1.5]" />
        </Button>
      </div>
    </>
  );
}
