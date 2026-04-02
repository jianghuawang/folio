import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onImportClick: () => void;
}

export function EmptyState({ onImportClick }: EmptyStateProps) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl">📚</div>
      <h2 className="mt-6 text-xl font-medium text-[--color-text-primary]">
        Your library is empty.
      </h2>
      <p className="mt-2 text-sm text-[--color-text-secondary]">
        Import an ePub file to get started.
      </p>
      <Button
        type="button"
        onClick={onImportClick}
        className="mt-6 rounded-full bg-[--color-primary] px-8 text-white hover:brightness-90"
      >
        Import Book
      </Button>
      <p className="mt-3 text-sm text-[--color-text-muted]">or drag .epub files here</p>
    </div>
  );
}
