import { formatPercent } from "@/lib/utils";

interface ProgressBarProps {
  chapterTitle: string;
  progress: number;
}

export function ProgressBar({ chapterTitle, progress }: ProgressBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-6">
      <div className="rounded-full bg-black/15 px-3 py-1 text-center text-[13px] text-[--color-text-muted] backdrop-blur-sm">
        {chapterTitle} · {formatPercent(progress)}
      </div>
    </div>
  );
}
