import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { barSurface, ghostControl, resolveChromeTheme, Z } from "@/lib/panel-chrome";
import type { ReadingTheme } from "@/types/settings";
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
  theme?: ReadingTheme;
}

function bannerFrameClassName(theme: ReadingTheme) {
  const chromeTheme = resolveChromeTheme(theme);

  return [
    "flex h-[52px] w-full max-w-[920px] items-center justify-between px-5 text-sm",
    chromeTheme === "dark" ? "text-white" : "text-black",
    barSurface(chromeTheme),
  ].join(" ");
}

export function TranslationBanner({
  bookTitle,
  exportProgress,
  job,
  onCancel,
  onPause,
  onResume,
  onRetryFailed,
  statusMessage,
  theme = "light",
}: TranslationBannerProps) {
  const ghostButtonClassName = `rounded-full px-4 ${ghostControl(resolveChromeTheme(theme))}`;
  if (!job && exportProgress === null) {
    return null;
  }

  if (exportProgress !== null) {
    return (
      <div className={`pointer-events-none absolute inset-x-0 top-0 ${Z.banner} flex justify-center px-6 pt-5`}>
        <div className={`${bannerFrameClassName(theme)} pointer-events-auto`}>
          <span>Generating bilingual ePub… {Math.round(exportProgress)}%</span>
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </div>
    );
  }

  const failedCount = job?.failed_paragraph_locators.length ?? 0;
  const hasRetryableFailures = Boolean(
    job && failedCount > 0 && job.status !== "in_progress" && job.status !== "paused",
  );

  if (
    !job ||
    !statusMessage ||
    (job.status !== "in_progress" && job.status !== "paused" && !hasRetryableFailures)
  ) {
    return null;
  }

  const isRestartPrompt = job.status === "paused" && job.pause_reason === "app_restart";
  const isPaused = job.status === "paused";

  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 ${Z.banner} flex justify-center px-6 pt-5`}>
      <div className={`${bannerFrameClassName(theme)} pointer-events-auto gap-4`}>
        <div className="flex min-w-0 items-center gap-2">
          {failedCount > 0 ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /> : null}
          <span className="truncate">
            {isRestartPrompt ? statusMessage : statusMessage.replace("'{title}'", bookTitle)}
          </span>
          {hasRetryableFailures ? (
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
          {hasRetryableFailures ? null : isRestartPrompt ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className={ghostButtonClassName}
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
                className={ghostButtonClassName}
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
                className={ghostButtonClassName}
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
