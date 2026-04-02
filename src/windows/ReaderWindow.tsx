import { useSearchParams } from "react-router-dom";

function ReaderColumn() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 7 }, (_, index) => (
        <div
          key={index}
          className={[
            "h-3 rounded-full bg-white/10",
            index % 4 === 0 ? "w-11/12" : "",
            index % 4 === 1 ? "w-full" : "",
            index % 4 === 2 ? "w-10/12" : "",
            index % 4 === 3 ? "w-9/12" : "",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function ReaderShellError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[--color-bg-window] px-6 text-[--color-text-primary]">
      <div className="w-full max-w-md rounded-2xl border border-[--color-border-strong] bg-[--color-bg-surface] p-6 text-center shadow-popup">
        <p className="text-sm font-medium text-[--color-destructive]">Unable to open reader shell.</p>
        <p className="mt-2 text-sm text-[--color-text-secondary]">{message}</p>
      </div>
    </main>
  );
}

export default function ReaderWindow() {
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get("bookId");

  if (!bookId) {
    return <ReaderShellError message="Missing required ?bookId query parameter." />;
  }

  return (
    <main className="min-h-screen bg-[--color-bg-window] text-[--color-text-primary]">
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-[--color-border] px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-[--color-text-secondary]">
              <span>TOC</span>
              <span>Theme</span>
              <span>Annot</span>
            </div>
            <div className="truncate text-center text-[13px] font-light text-[--color-text-secondary]">
              Reader Shell · {bookId}
            </div>
            <div className="flex items-center gap-3 text-sm text-[--color-text-secondary]">
              <span>AA</span>
              <span>Search</span>
              <span>Translate</span>
            </div>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center px-10 py-8 md:px-20">
          <div className="grid w-full max-w-6xl gap-12 md:grid-cols-2">
            <ReaderColumn />
            <ReaderColumn />
          </div>
        </section>

        <footer className="border-t border-[--color-border] px-6 py-3 text-center text-sm text-[--color-text-muted]">
          Chapter Title · 0%
        </footer>
      </div>
    </main>
  );
}
