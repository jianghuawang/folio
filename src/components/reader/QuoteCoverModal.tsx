import { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
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
      <DialogPortal>
        <DialogOverlay className="bg-white/[0.04] backdrop-blur-[10px]" />

        <DialogPrimitive.Content
          data-folio-quote-cover="true"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-48px)] max-w-[880px] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-[34px] border border-black/10 bg-white/84 p-0 text-black shadow-[0_30px_90px_rgba(0,0,0,0.18)] backdrop-blur-[28px] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogHeader className="border-b border-black/10 px-6 py-5 pr-20 text-left">
            <DialogTitle className="text-[20px] font-semibold tracking-[-0.02em] text-black/70">
              Create Quote Cover
            </DialogTitle>
          </DialogHeader>

          <DialogClose asChild>
            <button
              type="button"
              className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/72 text-black/45 transition hover:bg-white hover:text-black/68 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
              aria-label="Close quote cover creator"
            >
              <X className="h-5 w-5" />
            </button>
          </DialogClose>

          <div className="grid grid-cols-[400px_minmax(0,1fr)]">
            <div className="border-r border-black/10 p-6">
              <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white/54 shadow-[0_20px_52px_rgba(0,0,0,0.08)] backdrop-blur-[18px]">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Quote cover preview"
                    className="h-[400px] w-[400px] object-cover"
                  />
                ) : (
                  <div className="flex h-[400px] w-[400px] items-center justify-center text-sm text-black/45">
                    {isRenderingPreview ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Preview unavailable"
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-h-[520px] flex-col">
              <div className="border-b border-black/10 px-6 py-5">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-black/45">Theme</p>
                  <div className="flex flex-wrap gap-2.5">
                    {QUOTE_COVER_THEMES.map((theme) => {
                      const isActive = theme.id === themeId;

                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setThemeId(theme.id)}
                          className={[
                            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                            isActive
                              ? "border-black/15 bg-white text-black/80 shadow-[0_10px_24px_rgba(0,0,0,0.10)] ring-2 ring-[#0A84FF]"
                              : "border-black/10 bg-white/68 text-black/60 hover:bg-white/90 hover:text-black/72",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "h-3 w-3 rounded-full border border-black/10",
                              THEME_SWATCH_CLASS_NAMES[theme.id],
                            ].join(" ")}
                          />
                          {theme.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex-1 px-6 py-5">
                <div className="flex h-full flex-col space-y-3">
                  <p className="text-sm font-medium text-black/45">Quote Text</p>
                  <Textarea
                    value={quoteText}
                    onChange={(event) => setQuoteText(event.target.value)}
                    className="min-h-[260px] flex-1 resize-none rounded-[28px] border-black/10 bg-white px-5 py-4 text-base leading-7 text-black shadow-[0_14px_32px_rgba(0,0,0,0.06)] placeholder:text-black/30 focus-visible:ring-black/10"
                  />
                  {longTextWarning ? (
                    <p className="text-xs text-black/45">
                      Long quotes will be scaled down to fit the cover.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-auto flex items-center gap-3 border-t border-black/10 px-6 py-5">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full px-4 text-black/55 hover:bg-black/[0.04] hover:text-black/75"
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
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
