const SHELL_BOOK_COUNT = 8;

function SidebarRow({
  label,
  count,
  active,
}: {
  label: string;
  count: number | string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "flex h-9 w-full items-center justify-between rounded-md px-3 text-sm transition-colors",
        active
          ? "bg-[--color-sidebar-active-bg] text-[--color-sidebar-active-text]"
          : "text-[--color-text-muted] hover:bg-white/5 hover:text-[--color-text-primary]",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="text-xs text-[--color-text-muted]">{count}</span>
    </button>
  );
}

function ShellBookCard({ index }: { index: number }) {
  return (
    <article className="space-y-2">
      <div className="aspect-[8/11] w-full rounded-sm bg-[--color-bg-surface] animate-pulse" />
      <div className="space-y-1">
        <div className="h-3 w-4/5 rounded-full bg-white/10" />
        <div className="h-3 w-3/5 rounded-full bg-white/5" />
        <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[--color-text-muted]">
          {index % 3 === 0 ? "NEW" : `${(index + 1) * 3}%`}
        </div>
      </div>
    </article>
  );
}

export default function LibraryWindow() {
  return (
    <main className="min-h-screen bg-[--color-bg-window] text-[--color-text-primary]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[210px] shrink-0 border-r border-[--color-border] bg-[--color-bg-sidebar] px-4 py-6 lg:block">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[28px] font-bold tracking-tight text-[--color-text-primary]">
                Library
              </p>
              <div className="rounded-full border border-[--color-border] bg-[--color-bg-elevated] px-4 py-2 text-sm text-[--color-text-muted]">
                Search your books
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[--color-text-section]">
                Library
              </p>
              <SidebarRow label="All" count={12} active />
              <SidebarRow label="Recently Read" count={4} />
            </div>
          </div>
        </aside>

        <section className="flex min-h-screen flex-1 flex-col bg-[--color-bg-content]">
          <header className="flex items-center justify-between border-b border-[--color-border] px-6 py-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[--color-text-section]">
                Library
              </p>
              <h1 className="mt-1 text-[28px] font-bold tracking-tight">All</h1>
            </div>

            <button
              type="button"
              className="inline-flex items-center rounded-full bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition hover:brightness-90"
            >
              Import Book +
            </button>
          </header>

          <div className="flex-1 px-6 py-8">
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: SHELL_BOOK_COUNT }, (_, index) => (
                <ShellBookCard key={index} index={index} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
