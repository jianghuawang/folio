import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  QUOTE_COVER_THEMES,
  renderQuoteCoverBlob,
  type QuoteCoverThemeId,
} from "@/lib/quote-canvas";
import type { Book } from "@/types/book";

const THEME_SWATCH_CLASS_NAMES: Record<QuoteCoverThemeId, string> = {
  forest: "bg-[#1a2e1a]",
  midnight: "bg-[#1c1c1e]",
  ocean: "bg-[#0a3d62]",
  rose: "bg-[#fff0f3]",
  warm: "bg-[#f5f0e8]",
};

function slugifyFileName(value: string, fallback: string) {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");

  return normalized.length > 0 ? normalized : fallback;
}

async function saveBlobToDisk(blob: Blob, fileName: string) {
  if ("showSaveFilePicker" in window && typeof window.showSaveFilePicker === "function") {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          accept: {
            "image/png": [".png"],
          },
          description: "PNG Image",
        },
      ],
    });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  }

  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
  return true;
}

interface QuoteCoverModalProps {
  book: Book;
  initialText: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function QuoteCoverModal({
  book,
  initialText,
  onOpenChange,
  open,
}: QuoteCoverModalProps) {
  const [quoteText, setQuoteText] = useState(initialText);
  const [themeId, setThemeId] = useState<QuoteCoverThemeId>("warm");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setQuoteText(initialText);
      setThemeId("warm");
    }
  }, [initialText, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let isActive = true;
    let objectUrl: string | null = null;

    setIsRenderingPreview(true);

    void renderQuoteCoverBlob({
      book,
      quoteText,
      size: 1080,
      themeId,
    })
      .then((blob) => {
        if (!isActive) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return objectUrl;
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (isActive) {
          setIsRenderingPreview(false);
        }
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [book, open, quoteText, themeId]);

  const longTextWarning = useMemo(() => quoteText.trim().length > 280, [quoteText]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const blob = await renderQuoteCoverBlob({
        book,
        quoteText,
        themeId,
      });
      await saveBlobToDisk(blob, `${slugifyFileName(book.title, "folio_quote")}_quote.png`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      window.alert("Could not generate image. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-folio-quote-cover="true"
        className="max-w-[880px] rounded-[28px] border border-[--color-border-strong] bg-[--color-bg-surface] p-0 text-[--color-text-primary] shadow-popup"
      >
        <DialogHeader className="border-b border-[--color-border] px-6 py-5 text-left">
          <DialogTitle className="text-[26px] font-semibold text-[--color-text-primary]">
            Create Quote Cover
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[400px_minmax(0,1fr)] gap-0">
          <div className="border-r border-[--color-border] p-6">
            <div className="overflow-hidden rounded-[24px] bg-black/5">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Quote cover preview"
                  className="h-[400px] w-[400px] object-cover"
                />
              ) : (
                <div className="flex h-[400px] w-[400px] items-center justify-center text-sm text-[--color-text-muted]">
                  {isRenderingPreview ? <Loader2 className="h-5 w-5 animate-spin" /> : "Preview unavailable"}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col p-6">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium text-[--color-text-secondary]">Theme</p>
                <div className="flex flex-wrap gap-2">
                  {QUOTE_COVER_THEMES.map((theme) => {
                    const isActive = theme.id === themeId;

                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setThemeId(theme.id)}
                        className={[
                          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                          isActive
                            ? "border-[--color-primary] bg-[--color-primary]/10 text-[--color-text-primary]"
                            : "border-[--color-border-strong] bg-[--color-bg-elevated] text-[--color-text-secondary]",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "h-3 w-3 rounded-full",
                            THEME_SWATCH_CLASS_NAMES[theme.id],
                          ].join(" ")}
                        />
                        {theme.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-[--color-text-secondary]">Quote Text</p>
                <Textarea
                  value={quoteText}
                  onChange={(event) => setQuoteText(event.target.value)}
                  className="min-h-[220px] resize-none rounded-[24px] border-[--color-border-strong] bg-[--color-bg-elevated] text-[--color-text-primary] placeholder:text-[--color-text-muted]"
                />
                {longTextWarning ? (
                  <p className="text-xs text-[--color-destructive]">
                    Long quotes may not display well. Consider shortening.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-auto flex items-center gap-3 pt-6">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-4 text-[--color-text-secondary] hover:bg-white/5 hover:text-[--color-text-primary]"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-full bg-[--color-primary] px-5 text-white hover:brightness-90"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Image"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
