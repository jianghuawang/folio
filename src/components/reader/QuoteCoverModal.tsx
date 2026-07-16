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
  ghostControl,
  modalOverlay,
  modalSurface,
  resolveChromeTheme,
  Z,
} from "@/lib/panel-chrome";
import {
  QUOTE_COVER_THEMES,
  renderQuoteCoverBlob,
  type QuoteCoverThemeId,
} from "@/lib/quote-canvas";
import type { Book } from "@/types/book";
import type { ReadingTheme } from "@/types/settings";

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
  theme?: ReadingTheme;
}

export function QuoteCoverModal({
  book,
  initialText,
  onOpenChange,
  open,
  theme = "light",
}: QuoteCoverModalProps) {
  const chromeTheme = resolveChromeTheme(theme);
  const isDarkChrome = chromeTheme === "dark";
  const sectionBorder = isDarkChrome ? "border-white/[0.14]" : "border-black/10";
  const mutedLabel = isDarkChrome
    ? "text-sm font-medium text-white/45"
    : "text-sm font-medium text-black/45";
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
        <DialogOverlay className={modalOverlay(chromeTheme)} />

        <DialogPrimitive.Content
          data-folio-quote-cover="true"
          className={`fixed left-1/2 top-1/2 ${Z.modal} w-[calc(100vw-48px)] max-w-[880px] translate-x-[-50%] translate-y-[-50%] overflow-hidden p-0 duration-200 ${modalSurface(chromeTheme)}  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95`}
        >
          <DialogHeader className={`border-b ${sectionBorder} px-6 py-5 pr-20 text-left`}>
            <DialogTitle className={`text-[20px] font-semibold tracking-[-0.02em] ${isDarkChrome ? "text-white/80" : "text-black/70"}`}>
              Create Quote Cover
            </DialogTitle>
          </DialogHeader>

          <DialogClose asChild>
            <button
              type="button"
              className={`absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 ${isDarkChrome ? "border-white/[0.14] bg-white/[0.08] text-white/60 transition hover:bg-white/[0.14] hover:text-white focus-visible:ring-white/20" : "border-black/10 bg-white/72 text-black/45 transition hover:bg-white hover:text-black/68 focus-visible:ring-black/10"}`}
              aria-label="Close quote cover creator"
            >
              <X className="h-5 w-5" />
            </button>
          </DialogClose>

          <div className="grid grid-cols-[400px_minmax(0,1fr)]">
            <div className={`border-r ${sectionBorder} p-6`}>
              <div className={`overflow-hidden rounded-lg border shadow-[0_20px_52px_rgba(0,0,0,0.08)] backdrop-blur-[18px] ${isDarkChrome ? "border-white/[0.14] bg-white/[0.06]" : "border-black/10 bg-white/54"}`}>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Quote cover preview"
                    className="h-[400px] w-[400px] object-cover"
                  />
                ) : (
                  <div className={`flex h-[400px] w-[400px] items-center justify-center text-sm ${isDarkChrome ? "text-white/45" : "text-black/45"}`}>
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
              <div className={`border-b ${sectionBorder} px-6 py-5`}>
                <div className="space-y-3">
                  <p className={mutedLabel}>Theme</p>
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
                              ? isDarkChrome
                                ? "border-white/25 bg-white/[0.16] text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)] ring-2 ring-[#0A84FF]"
                                : "border-black/15 bg-white text-black/80 shadow-[0_10px_24px_rgba(0,0,0,0.10)] ring-2 ring-[#0A84FF]"
                              : isDarkChrome
                                ? "border-white/[0.14] bg-white/[0.06] text-white/60 hover:bg-white/[0.12] hover:text-white/85"
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
                  <p className={mutedLabel}>Quote Text</p>
                  <Textarea
                    value={quoteText}
                    onChange={(event) => setQuoteText(event.target.value)}
                    className={`min-h-[260px] flex-1 resize-none rounded-lg px-5 py-4 text-base leading-7 shadow-[0_14px_32px_rgba(0,0,0,0.06)] ${isDarkChrome ? "border-white/[0.12] bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-white/15" : "border-black/10 bg-white text-black placeholder:text-black/30 focus-visible:ring-black/10"}`}
                  />
                  {longTextWarning ? (
                    <p className={`text-xs ${isDarkChrome ? "text-white/45" : "text-black/45"}`}>
                      Long quotes will be scaled down to fit the cover.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className={`mt-auto flex items-center gap-3 border-t ${sectionBorder} px-6 py-5`}>
                <Button
                  type="button"
                  variant="ghost"
                  className={`rounded-full px-4 ${ghostControl(chromeTheme)}`}
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
