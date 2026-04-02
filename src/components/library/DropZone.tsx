import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface DropZoneProps {
  onFiles: (filePaths: string[]) => void;
  onVisibilityChange: (visible: boolean) => void;
}

export function DropZone({ onFiles, onVisibilityChange }: DropZoneProps) {
  useEffect(() => {
    let disposed = false;
    let unlistenPromise: Promise<(() => void) | undefined> | undefined;

    unlistenPromise = getCurrentWebview()
      .onDragDropEvent((event) => {
        if (disposed) {
          return;
        }

        if (event.payload.type === "enter" || event.payload.type === "over") {
          onVisibilityChange(true);
          return;
        }

        if (event.payload.type === "leave") {
          onVisibilityChange(false);
          return;
        }

        if (event.payload.type === "drop") {
          onVisibilityChange(false);

          const epubPaths = event.payload.paths.filter((path) =>
            path.toLowerCase().endsWith(".epub"),
          );

          if (epubPaths.length > 0) {
            onFiles(epubPaths);
          }
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      void unlistenPromise?.then((unlisten) => unlisten?.());
    };
  }, [onFiles, onVisibilityChange]);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-40 hidden" aria-hidden="true" />,
    document.body,
  );
}
