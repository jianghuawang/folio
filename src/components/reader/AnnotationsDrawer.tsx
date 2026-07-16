import { Download, Loader2, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

import type { ReaderAnnotationsTab } from "@/store/readerStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnchoredPanel } from "@/hooks/useAnchoredPanel";
import {
  controlSurface,
  ghostControl,
  listRowHover,
  NESTED_RADIUS,
  panelAnimation,
  panelHeading,
  panelMuted,
  panelNotch,
  panelSurface,
  resolveChromeTheme,
  Z,
  type ChromeTheme,
} from "@/lib/panel-chrome";
import { formatPercent } from "@/lib/utils";
import type { Highlight, Note } from "@/types/annotation";
import type { ReadingTheme } from "@/types/settings";

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
  theme?: ReadingTheme;
}

function EmptyState({ message, chromeTheme }: { message: string; chromeTheme: ChromeTheme }) {
  return <p className={`px-4 py-5 ${panelMuted(chromeTheme)}`}>{message}</p>;
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
  theme = "light",
}: AnnotationsDrawerProps) {
  const chromeTheme = resolveChromeTheme(theme);
  const rowPrimaryText = chromeTheme === "dark" ? "text-white/85" : "text-black/80";
  const rowSecondaryText = chromeTheme === "dark" ? "text-white/55" : "text-black/55";
  const rowMetaText = chromeTheme === "dark" ? "text-white/45" : "text-black/45";
  const deleteHoverFill = chromeTheme === "dark" ? "hover:bg-white/[0.1]" : "hover:bg-black/[0.07]";
  const panelPosition = useAnchoredPanel({
    anchorElement,
    clusterElement,
    maxWidth: ANNOTATIONS_PANEL_MAX_WIDTH_PX,
    open,
  });

  if (!open) {
    return null;
  }

  return createPortal(
    <div className={`fixed inset-0 ${Z.panel}`} onMouseDown={() => onOpenChange(false)}>
      <div
        className="absolute"
        style={{
          left: panelPosition.left,
          top: panelPosition.top,
          width: panelPosition.width,
        }}
      >
        <div
          className={`${panelAnimation} pointer-events-auto relative w-full`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className={panelNotch(chromeTheme)} style={{ left: panelPosition.notchLeft }} />

          <div className={`overflow-hidden ${panelSurface(chromeTheme)}`}>
            <Tabs
              value={activeTab}
              onValueChange={(value) => onTabChange(value as ReaderAnnotationsTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="space-y-2.5 p-4 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <p className={panelHeading(chromeTheme)}>Annotations</p>
                  <button
                    type="button"
                    onClick={onExportHighlights}
                    disabled={exportDisabled || exportPending}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${controlSurface(chromeTheme)} ${ghostControl(chromeTheme)}`}
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

                <TabsList
                  className={`grid h-8 w-full grid-cols-2 gap-0.5 rounded-md p-0.5 ${controlSurface(chromeTheme)}`}
                >
                  {(["highlights", "notes"] as const).map((tabValue) => (
                    <TabsTrigger
                      key={tabValue}
                      value={tabValue}
                      className={[
                        `h-full ${NESTED_RADIUS} text-[12px] font-medium`,
                        chromeTheme === "dark"
                          ? "text-white/50 data-[state=active]:bg-white/[0.16] data-[state=active]:text-white data-[state=active]:shadow-sm"
                          : "text-black/50 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm",
                      ].join(" ")}
                    >
                      {tabValue === "highlights" ? "Highlights" : "Notes"}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="highlights" className="mt-0 min-h-0 max-h-[56vh] overflow-y-auto px-2 pb-2">
                {highlightsLoading ? (
                  <EmptyState message="Loading highlights…" chromeTheme={chromeTheme} />
                ) : highlightError ? (
                  <InlineError onRetry={onRetryHighlights} />
                ) : highlightItems.length === 0 ? (
                  <EmptyState message="No highlights yet. Select text to start highlighting." chromeTheme={chromeTheme} />
                ) : (
                  <div className="space-y-0.5">
                    {highlightItems.map(({ highlight, meta }) => (
                      <div
                        key={highlight.id}
                        className={`group flex items-start gap-2.5 rounded-md px-2.5 py-2.5 transition-colors ${listRowHover(chromeTheme)}`}
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
                            <span className={`line-clamp-2 block text-[13px] leading-[1.45] ${rowPrimaryText}`}>
                              {highlight.text_excerpt}
                            </span>
                            <span className={`mt-1 block text-[11px] ${rowMetaText}`}>
                              {meta
                                ? `${meta.chapterTitle} · ${formatPercent(meta.progress)}`
                                : "Location unavailable"}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteHighlight(highlight.id)}
                          className={`${NESTED_RADIUS} p-1.5 text-[--color-text-muted] opacity-0 transition-colors ${deleteHoverFill} hover:text-[--color-destructive] group-hover:opacity-100`}
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
                  <EmptyState message="Loading notes…" chromeTheme={chromeTheme} />
                ) : noteError ? (
                  <InlineError onRetry={onRetryNotes} />
                ) : noteItems.length === 0 ? (
                  <EmptyState message="No notes yet. Select text and tap ✏ to add a note." chromeTheme={chromeTheme} />
                ) : (
                  <div className="space-y-0.5">
                    {noteItems.map(({ note, meta }) => (
                      <div
                        key={note.id}
                        className={`group flex items-start gap-2.5 rounded-md px-2.5 py-2.5 transition-colors ${listRowHover(chromeTheme)}`}
                      >
                        <button
                          type="button"
                          onClick={() => onJumpToNote(note)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className={`line-clamp-2 block text-[13px] leading-[1.45] ${rowPrimaryText}`}>
                            {note.text_excerpt}
                          </span>
                          <span className={`mt-1 line-clamp-2 block text-[12px] leading-[1.45] ${rowSecondaryText}`}>
                            {note.body}
                          </span>
                          <span className={`mt-1.5 block text-[11px] ${rowMetaText}`}>
                            {meta
                              ? `${meta.chapterTitle} · ${formatPercent(meta.progress)}`
                              : "Location unavailable"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteNote(note.id)}
                          className={`${NESTED_RADIUS} p-1.5 text-[--color-text-muted] opacity-0 transition-colors ${deleteHoverFill} hover:text-[--color-destructive] group-hover:opacity-100`}
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
