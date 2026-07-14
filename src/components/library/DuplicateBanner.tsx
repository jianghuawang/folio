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
          className="animate-fade-in rounded-[10px] border border-white/[0.12] bg-[#2c2c2e]/90 px-4 py-2.5 text-center text-[13px] text-white/85 shadow-popup backdrop-blur-xl"
        >
          “{title}” is already in your library.
        </div>
      ))}
    </div>,
    document.body,
  );
}
