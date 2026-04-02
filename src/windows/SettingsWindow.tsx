export default function SettingsWindow() {
  return (
    <main className="min-h-screen bg-[--color-bg-window] px-6 py-5 text-[--color-text-primary]">
      <div className="mx-auto flex h-full max-w-3xl flex-col rounded-[20px] border border-[--color-border] bg-[--color-bg-content] shadow-md">
        <header className="border-b border-[--color-border] px-6 py-5">
          <h1 className="text-xl font-semibold">Settings</h1>
        </header>

        <div className="border-b border-[--color-border] px-6 py-3">
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-[--color-text-muted] transition hover:text-[--color-text-primary]"
            >
              General
            </button>
            <button
              type="button"
              className="rounded-full bg-[--color-sidebar-active-bg] px-3 py-1.5 font-medium text-[--color-sidebar-active-text]"
            >
              Translation
            </button>
          </div>
        </div>

        <section className="flex-1 space-y-6 px-6 py-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[--color-text-secondary]">API Key Status</p>
            <p className="text-sm text-[--color-text-primary]">Not checked yet</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[--color-text-secondary]" htmlFor="apiKey">
              OpenRouter API Key
            </label>
            <div className="rounded-lg border border-[--color-border-strong] bg-[--color-bg-elevated] px-4 py-3 text-sm text-[--color-text-muted]">
              Enter a replacement key
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[--color-text-secondary]" htmlFor="model">
              Model
            </label>
            <div className="rounded-lg border border-[--color-border-strong] bg-[--color-bg-elevated] px-4 py-3 text-sm text-[--color-text-muted]">
              google/gemini-2.5-flash-lite-preview
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <button type="button" className="text-sm text-[--color-primary]">
              Clear Saved Key
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-full border border-[--color-border-strong] px-4 py-2 text-sm text-[--color-text-primary]"
              >
                Test Connection
              </button>
              <button
                type="button"
                className="rounded-full bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition hover:brightness-90"
              >
                Save
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
