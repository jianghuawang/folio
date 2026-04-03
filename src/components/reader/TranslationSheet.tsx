import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TranslationJob } from "@/types/translation";

interface TranslationSheetProps {
  availableLanguages: readonly string[];
  currentLanguage: string | null;
  job: TranslationJob | null;
  onOpenChange: (open: boolean) => void;
  onStart: (language: string, replaceExisting?: boolean) => Promise<void>;
  open: boolean;
  pending: boolean;
}

export function TranslationSheet({
  availableLanguages,
  currentLanguage,
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
      <DialogContent className="max-w-[520px] rounded-[28px] border border-[--color-border-strong] bg-[--color-bg-surface] p-8 text-[--color-text-primary] shadow-popup">
        <DialogHeader className="space-y-3 text-left">
          <DialogTitle className="text-[28px] font-semibold tracking-tight text-[--color-text-primary]">
            Translate Book
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[--color-text-secondary]">
            Original text remains visible alongside the translation. This may use API credits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label
            className="text-sm font-medium text-[--color-text-secondary]"
            htmlFor="translation-language"
          >
            Translate to:
          </label>
          <select
            id="translation-language"
            value={selectedLanguage}
            onChange={(event) => setSelectedLanguage(event.target.value)}
            className="h-12 w-full rounded-2xl border border-[--color-border-strong] bg-[--color-bg-elevated] px-4 text-sm text-[--color-text-primary] outline-none transition focus:border-[--color-primary]"
          >
            <option value="">Select language</option>
            {availableLanguages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </div>

        {isAlreadyComplete ? (
          <p className="text-sm text-[--color-text-secondary]">
            This book has already been translated to {selectedLanguage}.
          </p>
        ) : null}

        <DialogFooter className="gap-3 sm:justify-end">
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
            className="min-w-[156px] rounded-full bg-[--color-primary] px-5 text-white hover:brightness-90"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

