import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow, type PhysicalPosition, type PhysicalSize } from "@tauri-apps/api/window";

interface WindowStateSnapshot {
  isFocused: boolean;
  label: string;
  position: PhysicalPosition | null;
  size: PhysicalSize | null;
}

export function useWindowState() {
  const currentWindow = useMemo(() => getCurrentWindow(), []);
  const [state, setState] = useState<WindowStateSnapshot>({
    isFocused: true,
    label: currentWindow.label,
    position: null,
    size: null,
  });

  useEffect(() => {
    let isMounted = true;

    void currentWindow
      .innerSize()
      .then((size) => {
        if (isMounted) {
          setState((previous) => ({ ...previous, size }));
        }
      })
      .catch(() => undefined);

    void currentWindow
      .innerPosition()
      .then((position) => {
        if (isMounted) {
          setState((previous) => ({ ...previous, position }));
        }
      })
      .catch(() => undefined);

    let unlistenResize: (() => void) | null = null;
    let unlistenMove: (() => void) | null = null;
    let unlistenFocus: (() => void) | null = null;

    void currentWindow.onResized(({ payload }) => {
      setState((previous) => ({ ...previous, size: payload }));
    }).then((unlisten) => {
      unlistenResize = unlisten;
    });

    void currentWindow.onMoved(({ payload }) => {
      setState((previous) => ({ ...previous, position: payload }));
    }).then((unlisten) => {
      unlistenMove = unlisten;
    });

    void currentWindow.onFocusChanged(({ payload }) => {
      setState((previous) => ({ ...previous, isFocused: payload }));
    }).then((unlisten) => {
      unlistenFocus = unlisten;
    });

    return () => {
      isMounted = false;
      unlistenResize?.();
      unlistenMove?.();
      unlistenFocus?.();
    };
  }, [currentWindow]);

  return {
    currentWindow,
    ...state,
  };
}
