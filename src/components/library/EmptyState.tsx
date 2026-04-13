import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onImportClick: () => void;
}

export function EmptyState({ onImportClick }: EmptyStateProps) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl">📚</div>
      <h2 className="mt-6 text-[28px] font-semibold tracking-[-0.03em] text-[--color-text-primary]">
        Your library is empty.
      </h2>
      <p className="mt-3 max-w-md text-sm text-[--color-text-secondary]">
        Import an ePub file to get started.
      </p>
      <Button
        type="button"
        onClick={onImportClick}
        className="mt-7 rounded-[12px] border border-white/[0.1] bg-white/[0.1] px-8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-white/[0.14]"
      >
        Import Book
      </Button>
      <p className="mt-3 text-sm text-[--color-text-muted]">or drag .epub files here</p>
    </div>
  );
}
