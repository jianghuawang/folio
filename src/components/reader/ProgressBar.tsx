import { formatPercent } from "@/lib/utils";

interface ProgressBarProps {
  chapterTitle: string;
  progress: number;
  theme?: "light" | "sepia" | "dark";
}

export function ProgressBar({
  chapterTitle,
  progress,
  theme = "light",
}: ProgressBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-6">
      <div
        className={[
          "text-center text-[13px] font-medium tracking-[0.01em]",
          theme === "dark" ? "text-white/34" : "text-black/35",
        ].join(" ")}
      >
        {chapterTitle} · {formatPercent(progress)}
      </div>
    </div>
  );
}
