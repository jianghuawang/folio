import { BookOpen } from "lucide-react";

interface EmptyStateProps {
  onImportClick: () => void;
}

export function EmptyState({ onImportClick }: EmptyStateProps) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/[0.06]">
        <BookOpen className="h-8 w-8 stroke-[1.5] text-white/40" aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-[20px] font-semibold tracking-[-0.01em] text-white/90">
        No Books
      </h2>
      <p className="mt-1.5 max-w-md text-[13px] text-white/45">
        Books you import will appear here.
      </p>
      <button
        type="button"
        onClick={onImportClick}
        className="mt-6 inline-flex h-[28px] items-center justify-center rounded-md bg-[#0a84ff] px-4 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_0.5px_0_rgba(255,255,255,0.2)] transition-colors hover:bg-[#2492ff] active:bg-[#0a7ae0]"
      >
        Import Books…
      </button>
      <p className="mt-3 text-[12px] text-white/30">or drop ePub files anywhere in this window</p>
    </div>
  );
}
