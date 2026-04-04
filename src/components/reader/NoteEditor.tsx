import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { createPortal } from "react-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReaderPopupPosition } from "@/store/readerStore";

const NoteSchema = z.object({
  body: z.string(),
});

type NoteForm = z.infer<typeof NoteSchema>;

interface NoteEditorProps {
  initialBody: string;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  onSave: (body: string) => Promise<void>;
  position: ReaderPopupPosition;
  textExcerpt: string;
}

export function NoteEditor({
  initialBody,
  onCancel,
  onDelete,
  onSave,
  position,
  textExcerpt,
}: NoteEditorProps) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
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

    if (!trimmedBody && !onDelete) {
      setError("body", {
        message: "Note cannot be empty.",
        type: "manual",
      });
      return;
    }

    await onSave(data.body);
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
      className="fixed inset-0 z-[70]"
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
        <div className="relative">
          <div className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-black/10 bg-white/90" />

          <div className="max-h-[72vh] overflow-y-auto rounded-[32px] border border-black/10 bg-white/88 p-5 text-black shadow-[0_30px_90px_rgba(0,0,0,0.18)] backdrop-blur-[28px]">
            <p className="line-clamp-3 text-sm italic leading-6 text-black/55">
              &quot;{textExcerpt}&quot;
            </p>
            <div className="mt-4 h-px bg-black/10" />

            <form className="mt-4" onSubmit={handleSubmit(handleValidSubmit)}>
              <label className="text-sm font-semibold text-black/70" htmlFor="reader-note-body">
                Note
              </label>
              <Textarea
                id="reader-note-body"
                {...register("body")}
                className="mt-2 min-h-[140px] resize-none rounded-[24px] border-black/10 bg-white/75 px-5 py-4 text-[15px] leading-7 text-black placeholder:text-black/35 focus-visible:ring-[#0A84FF]"
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
                    className="rounded-full px-4 text-black/55 hover:bg-black/[0.05] hover:text-black"
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
