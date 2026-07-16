import { useLayoutEffect, useState } from "react";

const PANEL_VERTICAL_OFFSET_PX = 10;
const PANEL_VIEWPORT_PADDING_PX = 16;
const PANEL_MIN_WIDTH_PX = 320;
const NOTCH_EDGE_INSET_PX = 20;

interface AnchoredPanelOptions {
  anchorElement: HTMLElement | null;
  clusterElement: HTMLElement | null;
  maxWidth: number;
  open: boolean;
}

export interface AnchoredPanelPosition {
  left: number;
  /** Notch center, relative to the panel's left edge, clamped inside the
   *  rounded corners so it always points at the trigger cluster. */
  notchLeft: number;
  top: number;
  width: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolvePanelPosition({
  anchorElement,
  clusterElement,
  maxWidth,
  viewportWidth,
}: Omit<AnchoredPanelOptions, "open"> & { viewportWidth: number }): AnchoredPanelPosition {
  const panelWidth = Math.min(
    maxWidth,
    Math.max(PANEL_MIN_WIDTH_PX, viewportWidth - PANEL_VIEWPORT_PADDING_PX * 2),
  );
  const anchorRect = anchorElement?.getBoundingClientRect() ?? null;
  const clusterRect = clusterElement?.getBoundingClientRect() ?? anchorRect;
  const panelCenterX = clusterRect
    ? clusterRect.left + clusterRect.width / 2
    : anchorRect
      ? anchorRect.left + anchorRect.width / 2
      : PANEL_VIEWPORT_PADDING_PX + panelWidth / 2;
  const left = clamp(
    panelCenterX - panelWidth / 2,
    PANEL_VIEWPORT_PADDING_PX,
    viewportWidth - PANEL_VIEWPORT_PADDING_PX - panelWidth,
  );
  const top = (clusterRect?.bottom ?? anchorRect?.bottom ?? 64) + PANEL_VERTICAL_OFFSET_PX;
  const notchLeft = clamp(
    panelCenterX - left,
    NOTCH_EDGE_INSET_PX,
    panelWidth - NOTCH_EDGE_INSET_PX,
  );

  return {
    left,
    notchLeft,
    top,
    width: panelWidth,
  };
}

/**
 * Shared positioning for toolbar-anchored dropdown panels (TOC, annotations,
 * translation): centers the panel under the trigger cluster, clamps to the
 * viewport, and tracks anchor/viewport size changes while open.
 */
export function useAnchoredPanel({
  anchorElement,
  clusterElement,
  maxWidth,
  open,
}: AnchoredPanelOptions): AnchoredPanelPosition {
  const [panelPosition, setPanelPosition] = useState<AnchoredPanelPosition>(() =>
    resolvePanelPosition({
      anchorElement: null,
      clusterElement: null,
      maxWidth,
      viewportWidth: typeof window === "undefined" ? 1440 : window.innerWidth,
    }),
  );

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    let animationFrameId = 0;

    const updatePosition = () => {
      setPanelPosition(
        resolvePanelPosition({
          anchorElement,
          clusterElement,
          maxWidth,
          viewportWidth: window.innerWidth,
        }),
      );
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(updatePosition);
    };

    updatePosition();
    scheduleUpdate();

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);

    if (anchorElement) {
      resizeObserver?.observe(anchorElement);
    }

    if (clusterElement && clusterElement !== anchorElement) {
      resizeObserver?.observe(clusterElement);
    }

    window.addEventListener("resize", scheduleUpdate);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [anchorElement, clusterElement, maxWidth, open]);

  return panelPosition;
}
