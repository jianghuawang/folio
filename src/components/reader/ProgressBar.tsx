import { formatPercent } from "@/lib/utils";

interface ProgressBarProps {
  chapterTitle: string;
  progress: number;
}

export function ProgressBar({ chapterTitle, progress }: ProgressBarProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-center border-t border-[--color-border] bg-[--color-bg-window] px-6 text-center text-[13px] text-[--color-text-muted]">
      {chapterTitle} · {formatPercent(progress)}
    </div>
  );
}
