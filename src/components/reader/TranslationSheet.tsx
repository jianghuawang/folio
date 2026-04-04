import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, Loader2, X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TranslationJob } from "@/types/translation";

interface TranslationSheetProps {
  availableLanguages: readonly string[];
  currentLanguage: string | null;
  errorMessage?: string | null;
  job: TranslationJob | null;
  onOpenChange: (open: boolean) => void;
  onStart: (language: string, replaceExisting?: boolean) => Promise<void>;
  open: boolean;
  pending: boolean;
}

export function TranslationSheet({
  availableLanguages,
  currentLanguage,
  errorMessage = null,
  job,
  onOpenChange,
  onStart,
  open,
  pending,
}: TranslationSheetProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage ?? "");

  useEffect(() => {
    setSelectedLanguage(currentLanguage ?? "");
  }, [currentLanguage, open]);

  const isAlreadyComplete =
    Boolean(job) &&
    job?.target_language === selectedLanguage &&
    job.status === "complete" &&
    job.completed_paragraphs >= job.total_paragraphs;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-[rgba(24,24,27,0.18)] backdrop-blur-[10px]" />

        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-[calc(100vw-2rem)] max-w-[760px] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-[34px] border border-black/10 bg-white/84 text-black shadow-[0_30px_90px_rgba(0,0,0,0.18)] backdrop-blur-[28px] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.55),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))]"
          />

          <DialogClose className="absolute right-6 top-6 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/68 text-black/45 transition hover:bg-white hover:text-black/70 focus:outline-none focus:ring-2 focus:ring-black/10">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogClose>

          <div className="relative">
            <div className="border-b border-black/10 px-8 py-7 pr-20">
              <DialogTitle className="text-[20px] font-semibold tracking-[-0.02em] text-black/70 sm:text-[22px]">
                Translate Book
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-[560px] text-sm leading-6 text-black/45 sm:text-[15px]">
                Original text remains visible alongside the translation. This may use
                API credits.
              </DialogDescription>
            </div>

            <div className="space-y-5 px-8 py-6">
              <div className="rounded-[28px] border border-black/10 bg-white/66 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <label
                  className="text-sm font-medium text-black/50"
                  htmlFor="translation-language"
                >
                  Translate to
                </label>

                <div className="relative mt-3">
                  <select
                    id="translation-language"
                    value={selectedLanguage}
                    onChange={(event) => setSelectedLanguage(event.target.value)}
                    className="h-14 w-full appearance-none rounded-full border border-black/10 bg-white px-5 pr-12 text-[16px] font-medium text-black [color-scheme:light] outline-none transition focus:border-black/20 focus:bg-white"
                  >
                    <option value="">Select language</option>
                    {availableLanguages.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
                </div>
              </div>

              {isAlreadyComplete ? (
                <p className="rounded-[22px] border border-black/10 bg-black/[0.03] px-4 py-3 text-sm leading-6 text-black/55">
                  This book has already been translated to {selectedLanguage}. Starting
                  again will replace the existing version.
                </p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-[22px] border border-[#ff3b3026] bg-[#ff3b3010] px-4 py-3 text-sm leading-6 text-[#c53929]">
                  {errorMessage}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-black/10 px-8 py-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-black/10 bg-white/70 px-5 text-black/55 hover:bg-white hover:text-black/70"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="min-w-[182px] rounded-full bg-black px-6 text-white hover:bg-black/85 disabled:bg-black/20 disabled:text-white/80"
                disabled={!selectedLanguage || pending}
                onClick={() => void onStart(selectedLanguage, isAlreadyComplete)}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isAlreadyComplete ? (
                  "Re-translate"
                ) : (
                  "Start Translation"
                )}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
