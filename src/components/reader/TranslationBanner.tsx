import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TranslationJob } from "@/types/translation";

interface TranslationBannerProps {
  bookTitle: string;
  exportProgress: number | null;
  job: TranslationJob | null;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetryFailed: () => void;
  statusMessage: string | null;
}

const bannerFrameClassName =
  "flex h-[52px] w-full max-w-[920px] items-center justify-between rounded-full border border-black/5 bg-white/92 px-5 text-sm text-black shadow-[0_18px_48px_rgba(0,0,0,0.14)] backdrop-blur-[20px]";

export function TranslationBanner({
  bookTitle,
  exportProgress,
  job,
  onCancel,
  onPause,
  onResume,
  onRetryFailed,
  statusMessage,
}: TranslationBannerProps) {
  if (!job && exportProgress === null) {
    return null;
  }

  if (exportProgress !== null) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-6 pt-5">
        <div className={`${bannerFrameClassName} pointer-events-auto`}>
          <span>Generating bilingual ePub… {Math.round(exportProgress)}%</span>
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </div>
    );
  }

  if (!job || !statusMessage || (job.status !== "in_progress" && job.status !== "paused")) {
    return null;
  }

  const failedCount = job.failed_paragraph_locators.length;
  const isRestartPrompt = job.status === "paused" && job.pause_reason === "app_restart";
  const isPaused = job.status === "paused";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-6 pt-5">
      <div className={`${bannerFrameClassName} pointer-events-auto gap-4`}>
        <div className="flex min-w-0 items-center gap-2">
          {failedCount > 0 ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /> : null}
          <span className="truncate">
            {isRestartPrompt ? statusMessage : statusMessage.replace("'{title}'", bookTitle)}
          </span>
          {failedCount > 0 ? (
            <button
              type="button"
              onClick={onRetryFailed}
              className="shrink-0 text-[--color-primary] underline underline-offset-4"
            >
              Retry Failed
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isRestartPrompt ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-4 text-black/70 hover:bg-black/[0.04] hover:text-black/85"
                onClick={onCancel}
              >
                Stop
              </Button>
              <Button
                type="button"
                className="rounded-full bg-[--color-primary] px-4 text-white hover:brightness-90"
                onClick={onResume}
              >
                Continue
              </Button>
            </>
          ) : isPaused ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-4 text-black/70 hover:bg-black/[0.04] hover:text-black/85"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full bg-[--color-primary] px-4 text-white hover:brightness-90"
                onClick={onResume}
              >
                Resume
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-4 text-black/70 hover:bg-black/[0.04] hover:text-black/85"
                onClick={onPause}
              >
                Pause
              </Button>
              <Button
                type="button"
                className="rounded-full bg-[--color-primary] px-4 text-white hover:brightness-90"
                onClick={onCancel}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
