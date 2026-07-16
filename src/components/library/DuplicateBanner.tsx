import { useEffect } from "react";
import { createPortal } from "react-dom";

import { panelAnimation, panelBody, panelSurface, Z } from "@/lib/panel-chrome";

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
    <div className={`fixed left-1/2 top-4 ${Z.modal} flex w-full max-w-[520px] -translate-x-1/2 flex-col gap-2 px-4`}>
      {titles.map((title) => (
        <div
          key={title}
          className={`${panelAnimation} px-4 py-2.5 text-center ${panelBody("dark")} ${panelSurface("dark")}`}
        >
          “{title}” is already in your library.
        </div>
      ))}
    </div>,
    document.body,
  );
}
