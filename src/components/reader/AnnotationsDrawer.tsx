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

const ANNOTATIONS_PANEL_MAX_WIDTH_PX = 400;
const PANEL_VERTICAL_OFFSET_PX = 10;
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

  return {
    left,
    top,
    width: panelWidth,
  };
}

function EmptyState({ message }: { message: string }) {
  return <p className="px-4 py-5 text-[13px] text-black/45">{message}</p>;
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-4 py-5">
      <p className="text-[13px] text-[--color-destructive]">Failed to load annotations.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-[12px] text-[--color-primary] underline underline-offset-4"
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
          className="animate-fade-in pointer-events-auto relative w-full"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="overflow-hidden rounded-[12px] border border-black/[0.08] bg-white/95 text-black shadow-popup backdrop-blur-2xl">
            <Tabs
              value={activeTab}
              onValueChange={(value) => onTabChange(value as ReaderAnnotationsTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="space-y-2.5 p-4 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/40">
                    Annotations
                  </p>
                  <button
                    type="button"
                    onClick={onExportHighlights}
                    disabled={exportDisabled || exportPending}
                    className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-black/[0.08] bg-black/[0.04] px-2.5 text-[12px] font-medium text-black/70 transition-colors hover:bg-black/[0.07] hover:text-black/85 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {exportPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Export</span>
                  </button>
                </div>

                {exportErrorMessage ? (
                  <p className="text-[12px] text-[--color-destructive]">{exportErrorMessage}</p>
                ) : null}

                <TabsList className="grid h-8 w-full grid-cols-2 gap-0.5 rounded-[8px] border border-black/[0.08] bg-black/[0.04] p-0.5">
                  <TabsTrigger
                    value="highlights"
                    className="h-full rounded-[6px] text-[12px] font-medium text-black/50 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm"
                  >
                    Highlights
                  </TabsTrigger>
                  <TabsTrigger
                    value="notes"
                    className="h-full rounded-[6px] text-[12px] font-medium text-black/50 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm"
                  >
                    Notes
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="highlights" className="mt-0 min-h-0 max-h-[56vh] overflow-y-auto px-2 pb-2">
                {highlightsLoading ? (
                  <EmptyState message="Loading highlights…" />
                ) : highlightError ? (
                  <InlineError onRetry={onRetryHighlights} />
                ) : highlightItems.length === 0 ? (
                  <EmptyState message="No highlights yet. Select text to start highlighting." />
                ) : (
                  <div className="space-y-0.5">
                    {highlightItems.map(({ highlight, meta }) => (
                      <div
                        key={highlight.id}
                        className="group flex items-start gap-2.5 rounded-[8px] px-2.5 py-2.5 transition-colors hover:bg-black/[0.05]"
                      >
                        <button
                          type="button"
                          onClick={() => onJumpToHighlight(highlight)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <span
                            className={[
                              "mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full",
                              HIGHLIGHT_DOT_CLASS_NAMES[highlight.color],
                            ].join(" ")}
                          />
                          <span className="min-w-0">
                            <span className="line-clamp-2 block text-[13px] leading-[1.45] text-black/80">
                              {highlight.text_excerpt}
                            </span>
                            <span className="mt-1 block text-[11px] text-black/45">
                              {meta
                                ? `${meta.chapterTitle} · ${formatPercent(meta.progress)}`
                                : "Location unavailable"}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteHighlight(highlight.id)}
                          className="rounded-[6px] p-1.5 text-[--color-text-muted] opacity-0 transition-colors hover:bg-black/[0.07] hover:text-[--color-destructive] group-hover:opacity-100"
                          aria-label="Delete highlight"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-0 min-h-0 max-h-[56vh] overflow-y-auto px-2 pb-2">
                {notesLoading ? (
                  <EmptyState message="Loading notes…" />
                ) : noteError ? (
                  <InlineError onRetry={onRetryNotes} />
                ) : noteItems.length === 0 ? (
                  <EmptyState message="No notes yet. Select text and tap ✏ to add a note." />
                ) : (
                  <div className="space-y-0.5">
                    {noteItems.map(({ note, meta }) => (
                      <div
                        key={note.id}
                        className="group flex items-start gap-2.5 rounded-[8px] px-2.5 py-2.5 transition-colors hover:bg-black/[0.05]"
                      >
                        <button
                          type="button"
                          onClick={() => onJumpToNote(note)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="line-clamp-2 block text-[13px] leading-[1.45] text-black/80">
                            {note.text_excerpt}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[12px] leading-[1.45] text-black/55">
                            {note.body}
                          </span>
                          <span className="mt-1.5 block text-[11px] text-black/45">
                            {meta
                              ? `${meta.chapterTitle} · ${formatPercent(meta.progress)}`
                              : "Location unavailable"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteNote(note.id)}
                          className="rounded-[6px] p-1.5 text-[--color-text-muted] opacity-0 transition-colors hover:bg-black/[0.07] hover:text-[--color-destructive] group-hover:opacity-100"
                          aria-label="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
