import { formatPercent } from "@/lib/utils";

interface ProgressBarProps {
  chapterTitle: string;
  progress: number;
}

export function ProgressBar({ chapterTitle, progress }: ProgressBarProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 border-t border-[--color-border] bg-[--color-bg-surface]/90 px-6 py-3 text-center text-sm text-[--color-text-muted] backdrop-blur">
      {chapterTitle} · {formatPercent(progress)}
    </div>
  );
}
