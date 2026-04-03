import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const NoteSchema = z.object({
  body: z.string(),
});

type NoteForm = z.infer<typeof NoteSchema>;

interface NoteEditorProps {
  initialBody: string;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  onSave: (body: string) => Promise<void>;
  textExcerpt: string;
}

export function NoteEditor({
  initialBody,
  onCancel,
  onDelete,
  onSave,
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

  return (
    <div
      data-folio-note-editor="true"
      className="fixed left-1/2 top-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2 px-4"
    >
      <div className="rounded-[24px] border border-[--color-border-strong] bg-[--color-bg-surface] p-5 shadow-popup">
        <p className="text-sm italic text-[--color-text-secondary]">&quot;{textExcerpt}&quot;</p>
        <div className="mt-4 h-px bg-[--color-border]" />

        <form className="mt-4" onSubmit={handleSubmit(handleValidSubmit)}>
          <label
            className="text-sm font-medium text-[--color-text-primary]"
            htmlFor="reader-note-body"
          >
            Note
          </label>
          <Textarea
            id="reader-note-body"
            {...register("body")}
            className="mt-2 min-h-[140px] resize-none rounded-2xl border-[--color-border-strong] bg-[--color-bg-elevated] text-[--color-text-primary] placeholder:text-[--color-text-muted]"
            placeholder="Write a note…"
          />
          {errors.body ? (
            <p className="mt-2 text-xs text-[--color-destructive]">{errors.body.message}</p>
          ) : null}

          <div className="mt-5 flex items-center justify-between">
            <div>
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="text-sm text-[--color-destructive] underline underline-offset-4"
                >
                  Delete Note
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-4 text-[--color-text-secondary] hover:bg-white/5 hover:text-[--color-text-primary]"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="min-w-[88px] rounded-full bg-[--color-primary] px-4 text-white hover:brightness-90"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

