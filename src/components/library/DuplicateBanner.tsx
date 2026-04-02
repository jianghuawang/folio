import { useEffect } from "react";
import { createPortal } from "react-dom";

interface DuplicateBannerProps {
  titles: string[];
  onDismiss: () => void;
}

export function DuplicateBanner({ titles, onDismiss }: DuplicateBannerProps) {
  useEffect(() => {
    if (titles.length === 0) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      onDismiss();
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [onDismiss, titles]);

  if (titles.length === 0) {
    return null;
  }

  return createPortal(
    <div className="fixed left-1/2 top-4 z-50 flex w-full max-w-[520px] -translate-x-1/2 flex-col gap-2 px-4">
      {titles.map((title) => (
        <div
          key={title}
          className="rounded-full border border-[--color-border-strong] bg-[--color-bg-surface] px-4 py-3 text-sm text-[--color-text-primary] shadow-popup"
        >
          &apos;{title}&apos; is already in your library.
        </div>
      ))}
    </div>,
    document.body,
  );
}
