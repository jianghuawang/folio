import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { createPortal } from "react-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  divider,
  ghostControl,
  inputSurface,
  panelAnimation,
  panelNotch,
  panelSurface,
  resolveChromeTheme,
  Z,
} from "@/lib/panel-chrome";
import type { ReaderPopupPosition } from "@/store/readerStore";
import type { ReadingTheme } from "@/types/settings";

const NoteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty."),
});

type NoteForm = z.infer<typeof NoteSchema>;

interface NoteEditorProps {
  initialBody: string;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  onSave: (body: string) => Promise<void>;
  position: ReaderPopupPosition;
  textExcerpt: string;
  theme?: ReadingTheme;
}

export function NoteEditor({
  initialBody,
  onCancel,
  onDelete,
  onSave,
  position,
  textExcerpt,
  theme = "light",
}: NoteEditorProps) {
  const chromeTheme = resolveChromeTheme(theme);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<NoteForm>({
    defaultValues: {
      body: initialBody,
    },
    mode: "onBlur",
    resolver: zodResolver(NoteSchema),
  });

  useEffect(() => {
    reset({ body: initialBody });
  }, [initialBody, reset]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  const handleDelete = async () => {
    await onDelete?.();
  };

  const handleValidSubmit = async (data: NoteForm) => {
    const trimmedBody = data.body.trim();

    await onSave(trimmedBody);
  };

  const popupWidth = 460;
  const viewportPadding = 24;
  const estimatedPopupHeight = onDelete ? 408 : 372;
  const clampedLeft =
    typeof window === "undefined"
      ? position.left
      : Math.min(
          Math.max(position.left, viewportPadding + popupWidth / 2),
          window.innerWidth - viewportPadding - popupWidth / 2,
        );
  const clampedTop =
    typeof window === "undefined"
      ? position.top
      : Math.max(
          88,
          Math.min(
            position.top - 18,
            window.innerHeight - viewportPadding - estimatedPopupHeight,
          ),
        );

  return createPortal(
    <div
      className={`fixed inset-0 ${Z.popup}`}
      onMouseDown={() => onCancel()}
    >
      <div
        data-folio-note-editor="true"
        className="absolute w-[min(460px,calc(100vw-32px))] px-1"
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          left: clampedLeft,
          top: clampedTop,
          transform: "translateX(-50%)",
        }}
      >
        <div className={`relative ${panelAnimation}`}>
          <div className={`${panelNotch(chromeTheme)} left-1/2`} />

          <div className={`max-h-[72vh] overflow-y-auto p-5 ${panelSurface(chromeTheme)}`}>
            <p
              className={`line-clamp-3 text-sm italic leading-6 ${
                chromeTheme === "dark" ? "text-white/55" : "text-black/55"
              }`}
            >
              &quot;{textExcerpt}&quot;
            </p>
            <div className={`mt-4 h-px ${divider(chromeTheme)}`} />

            <form className="mt-4" onSubmit={handleSubmit(handleValidSubmit)}>
              <label
                className={`text-sm font-semibold ${
                  chromeTheme === "dark" ? "text-white/75" : "text-black/70"
                }`}
                htmlFor="reader-note-body"
              >
                Note
              </label>
              <Textarea
                id="reader-note-body"
                {...register("body")}
                className={`mt-2 min-h-[140px] resize-none px-5 py-4 text-[15px] leading-7 focus-visible:ring-[#0A84FF] ${inputSurface(chromeTheme)}`}
                placeholder="Write a note…"
              />
              {errors.body ? (
                <p className="mt-2 text-xs text-[--color-destructive]">{errors.body.message}</p>
              ) : null}

              <div className="mt-5 flex items-center justify-between gap-4">
                <div>
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      className="text-sm font-medium text-[--color-destructive] underline underline-offset-4"
                    >
                      Delete Note
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className={`rounded-full px-4 ${ghostControl(chromeTheme)}`}
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="min-w-[88px] rounded-full bg-[--color-primary] px-5 text-white hover:brightness-90"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
