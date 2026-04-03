import { Trash2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

interface AnnotationsDrawerProps {
  highlightError: boolean;
  highlightItems: Array<{ highlight: Highlight; meta?: AnnotationMeta | null }>;
  highlightsLoading: boolean;
  noteError: boolean;
  noteItems: Array<{ note: Note; meta?: AnnotationMeta | null }>;
  notesLoading: boolean;
  onDeleteHighlight: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onJumpToHighlight: (highlight: Highlight) => void;
  onJumpToNote: (note: Note) => void;
  onOpenChange: (open: boolean) => void;
  onRetryHighlights: () => void;
  onRetryNotes: () => void;
  open: boolean;
}

function EmptyState({ message }: { message: string }) {
  return <p className="px-6 py-6 text-sm text-[--color-text-muted]">{message}</p>;
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
  highlightError,
  highlightItems,
  highlightsLoading,
  noteError,
  noteItems,
  notesLoading,
  onDeleteHighlight,
  onDeleteNote,
  onJumpToHighlight,
  onJumpToNote,
  onOpenChange,
  onRetryHighlights,
  onRetryNotes,
  open,
}: AnnotationsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-l border-[--color-border] bg-[--color-bg-surface] p-0 text-[--color-text-primary] sm:max-w-[280px]"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-[--color-border] px-6 py-5 text-left">
            <SheetTitle className="text-[22px] font-semibold text-[--color-text-primary]">
              Annotations
            </SheetTitle>
            <SheetDescription className="text-sm text-[--color-text-muted]">
              Browse highlights and notes for this book.
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="highlights" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-[--color-border] px-4 py-3">
              <TabsList className="grid w-full grid-cols-2 rounded-full bg-[--color-bg-elevated]">
                <TabsTrigger value="highlights" className="rounded-full">
                  Highlights
                </TabsTrigger>
                <TabsTrigger value="notes" className="rounded-full">
                  Notes
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="highlights" className="mt-0 min-h-0 flex-1 overflow-y-auto">
              {highlightsLoading ? (
                <EmptyState message="Loading highlights…" />
              ) : highlightError ? (
                <InlineError onRetry={onRetryHighlights} />
              ) : highlightItems.length === 0 ? (
                <EmptyState message="No highlights yet. Select text to start highlighting." />
              ) : (
                <div className="divide-y divide-[--color-border]">
                  {highlightItems.map(({ highlight, meta }) => (
                    <div
                      key={highlight.id}
                      className="group flex items-start gap-3 px-4 py-4 transition hover:bg-white/[0.03]"
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
                          <span className="line-clamp-2 block text-sm text-[--color-text-primary]">
                            {highlight.text_excerpt}
                          </span>
                          <span className="mt-1 block text-xs text-[--color-text-muted]">
                            {meta ? `${meta.chapterTitle} · ${formatPercent(meta.progress)}` : "Location unavailable"}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteHighlight(highlight.id)}
                        className="rounded-full p-2 text-[--color-text-muted] opacity-0 transition hover:bg-white/5 hover:text-[--color-destructive] group-hover:opacity-100"
                        aria-label="Delete highlight"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-0 min-h-0 flex-1 overflow-y-auto">
              {notesLoading ? (
                <EmptyState message="Loading notes…" />
              ) : noteError ? (
                <InlineError onRetry={onRetryNotes} />
              ) : noteItems.length === 0 ? (
                <EmptyState message="No notes yet. Select text and tap ✏ to add a note." />
              ) : (
                <div className="divide-y divide-[--color-border]">
                  {noteItems.map(({ note, meta }) => (
                    <div
                      key={note.id}
                      className="group flex items-start gap-3 px-4 py-4 transition hover:bg-white/[0.03]"
                    >
                      <button
                        type="button"
                        onClick={() => onJumpToNote(note)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="line-clamp-2 block text-sm text-[--color-text-primary]">
                          {note.text_excerpt}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-xs text-[--color-text-secondary]">
                          {note.body}
                        </span>
                        <span className="mt-2 block text-xs text-[--color-text-muted]">
                          {meta ? `${meta.chapterTitle} · ${formatPercent(meta.progress)}` : "Location unavailable"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        className="rounded-full p-2 text-[--color-text-muted] opacity-0 transition hover:bg-white/5 hover:text-[--color-destructive] group-hover:opacity-100"
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
      </SheetContent>
    </Sheet>
  );
}
