import { Download, Loader2, Trash2 } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { ReaderAnnotationsTab } from "@/store/readerStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPercent } from "@/lib/utils";
import type { Highlight, Note } from "@/types/annotation";

interface AnnotationMeta {
  chapterTitle: string;
  progress: number;
}

const HIGHLIGHT_DOT_CLASS_NAMES: Record<Highlight["color"], string> = {
  "#FFD60A": "bg-[#FFD60A]",
  "#30D158": "bg-[#30D158]",
  "#0A84FF": "bg-[#0A84FF]",
  "#FF375F": "bg-[#FF375F]",
  "#BF5AF2": "bg-[#BF5AF2]",
};

const ANNOTATIONS_PANEL_MAX_WIDTH_PX = 604;
const NOTCH_HORIZONTAL_PADDING_PX = 28;
const NOTCH_SIZE_PX = 24;
const PANEL_VERTICAL_OFFSET_PX = 18;
const PANEL_VIEWPORT_PADDING_PX = 16;

interface AnnotationsDrawerProps {
  activeTab: ReaderAnnotationsTab;
  anchorElement: HTMLElement | null;
  clusterElement: HTMLElement | null;
  exportDisabled: boolean;
  exportErrorMessage: string | null;
  exportPending: boolean;
  highlightError: boolean;
  highlightItems: Array<{ highlight: Highlight; meta?: AnnotationMeta | null }>;
  highlightsLoading: boolean;
  noteError: boolean;
  noteItems: Array<{ note: Note; meta?: AnnotationMeta | null }>;
  notesLoading: boolean;
  onDeleteHighlight: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onExportHighlights: () => void;
  onJumpToHighlight: (highlight: Highlight) => void;
  onJumpToNote: (note: Note) => void;
  onOpenChange: (open: boolean) => void;
  onRetryHighlights: () => void;
  onRetryNotes: () => void;
  onTabChange: (tab: ReaderAnnotationsTab) => void;
  open: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolvePanelPosition({
  anchorElement,
  clusterElement,
  viewportWidth,
}: Pick<AnnotationsDrawerProps, "anchorElement" | "clusterElement"> & {
  viewportWidth: number;
}) {
  const panelWidth = Math.min(
    ANNOTATIONS_PANEL_MAX_WIDTH_PX,
    Math.max(320, viewportWidth - PANEL_VIEWPORT_PADDING_PX * 2),
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
  const notchTargetX = anchorRect
    ? anchorRect.left + anchorRect.width / 2
    : clusterRect
      ? clusterRect.left + clusterRect.width / 2
      : panelCenterX;
  const notchCenterX = clamp(
    notchTargetX - left,
    NOTCH_HORIZONTAL_PADDING_PX,
    panelWidth - NOTCH_HORIZONTAL_PADDING_PX,
  );

  return {
    left,
    notchLeft: notchCenterX - NOTCH_SIZE_PX / 2,
    top,
    width: panelWidth,
  };
}

function EmptyState({ message }: { message: string }) {
  return <p className="px-6 py-6 text-sm text-black/45">{message}</p>;
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-6 py-6">
      <p className="text-sm text-[--color-destructive]">Failed to load annotations.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-xs text-[--color-primary] underline underline-offset-4"
      >
        Retry
      </button>
    </div>
  );
}

export function AnnotationsDrawer({
  activeTab,
  anchorElement,
  clusterElement,
  exportDisabled,
  exportErrorMessage,
  exportPending,
  highlightError,
  highlightItems,
  highlightsLoading,
  noteError,
  noteItems,
  notesLoading,
  onDeleteHighlight,
  onDeleteNote,
  onExportHighlights,
  onJumpToHighlight,
  onJumpToNote,
  onOpenChange,
  onRetryHighlights,
  onRetryNotes,
  onTabChange,
  open,
}: AnnotationsDrawerProps) {
  const [panelPosition, setPanelPosition] = useState(() =>
    resolvePanelPosition({
      anchorElement: null,
      clusterElement: null,
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
  }, [anchorElement, clusterElement, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40" onMouseDown={() => onOpenChange(false)}>
      <div
        className="absolute"
        style={{
          left: panelPosition.left,
          top: panelPosition.top,
          width: panelPosition.width,
        }}
      >
        <div
          className="pointer-events-auto relative w-full origin-top-left animate-in zoom-in-95 duration-[160ms] ease-out"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            className="absolute top-0 h-6 w-6 -translate-y-1/2 rotate-45 border-l border-t border-black/10 bg-white/88"
            style={{ left: panelPosition.notchLeft }}
          />

          <div className="overflow-hidden rounded-[34px] border border-black/10 bg-white/84 text-black shadow-[0_30px_90px_rgba(0,0,0,0.18)] backdrop-blur-[28px]">
            <div className="border-b border-black/10 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-black/70">
                    Annotations
                  </h2>
                  <p className="mt-1 text-sm text-black/45">
                    Browse highlights and notes for this book.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onExportHighlights}
                  disabled={exportDisabled || exportPending}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-black/70 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {exportPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span>Export Highlights</span>
                </button>
              </div>

              {exportErrorMessage ? (
                <p className="mt-3 text-sm text-[--color-destructive]">{exportErrorMessage}</p>
              ) : null}
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => onTabChange(value as ReaderAnnotationsTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="border-b border-black/10 px-4 py-3">
                <TabsList className="grid w-full max-w-[280px] grid-cols-2 rounded-full bg-black/[0.06]">
                  <TabsTrigger value="highlights" className="rounded-full">
                    Highlights
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="rounded-full">
                    Notes
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="highlights" className="mt-0 min-h-0 max-h-[62vh] overflow-y-auto">
                {highlightsLoading ? (
                  <EmptyState message="Loading highlights…" />
                ) : highlightError ? (
                  <InlineError onRetry={onRetryHighlights} />
                ) : highlightItems.length === 0 ? (
                  <EmptyState message="No highlights yet. Select text to start highlighting." />
                ) : (
                  <div className="divide-y divide-black/10">
                    {highlightItems.map(({ highlight, meta }) => (
                      <div
                        key={highlight.id}
                        className="group flex items-start gap-3 px-4 py-4 transition hover:bg-black/[0.03]"
                      >
                        <button
                          type="button"
                          onClick={() => onJumpToHighlight(highlight)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <span
                            className={[
                              "mt-1 h-3 w-3 shrink-0 rounded-full",
                              HIGHLIGHT_DOT_CLASS_NAMES[highlight.color],
                            ].join(" ")}
                          />
                          <span className="min-w-0">
                            <span className="line-clamp-2 block text-sm text-black/80">
                              {highlight.text_excerpt}
                            </span>
                            <span className="mt-1 block text-xs text-black/45">
                              {meta
                                ? `${meta.chapterTitle} · ${formatPercent(meta.progress)}`
                                : "Location unavailable"}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteHighlight(highlight.id)}
                          className="rounded-full p-2 text-[--color-text-muted] opacity-0 transition hover:bg-black/[0.05] hover:text-[--color-destructive] group-hover:opacity-100"
                          aria-label="Delete highlight"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-0 min-h-0 max-h-[62vh] overflow-y-auto">
                {notesLoading ? (
                  <EmptyState message="Loading notes…" />
                ) : noteError ? (
                  <InlineError onRetry={onRetryNotes} />
                ) : noteItems.length === 0 ? (
                  <EmptyState message="No notes yet. Select text and tap ✏ to add a note." />
                ) : (
                  <div className="divide-y divide-black/10">
                    {noteItems.map(({ note, meta }) => (
                      <div
                        key={note.id}
                        className="group flex items-start gap-3 px-4 py-4 transition hover:bg-black/[0.03]"
                      >
                        <button
                          type="button"
                          onClick={() => onJumpToNote(note)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="line-clamp-2 block text-sm text-black/80">
                            {note.text_excerpt}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs text-black/55">
                            {note.body}
                          </span>
                          <span className="mt-2 block text-xs text-black/45">
                            {meta
                              ? `${meta.chapterTitle} · ${formatPercent(meta.progress)}`
                              : "Location unavailable"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteNote(note.id)}
                          className="rounded-full p-2 text-[--color-text-muted] opacity-0 transition hover:bg-black/[0.05] hover:text-[--color-destructive] group-hover:opacity-100"
                          aria-label="Delete note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
