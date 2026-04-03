import { confirm } from "@tauri-apps/plugin-dialog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { TranslationTab } from "@/components/settings/TranslationTab";
import { useApiKeyStatus, useClearApiKey, useSaveApiKey, useTestOpenRouterConnection } from "@/hooks/useApiKeyStatus";
import { useAppSettings, useSaveAppSettings } from "@/hooks/useAppSettings";

export default function SettingsWindow() {
  const appSettingsQuery = useAppSettings();
  const saveAppSettingsMutation = useSaveAppSettings();
  const apiKeyStatusQuery = useApiKeyStatus();
  const saveApiKeyMutation = useSaveApiKey();
  const clearApiKeyMutation = useClearApiKey();
  const testConnectionMutation = useTestOpenRouterConnection();

  const isLoading = appSettingsQuery.isLoading || apiKeyStatusQuery.isLoading;
  const hasError = appSettingsQuery.error || apiKeyStatusQuery.error;

  return (
    <main className="min-h-screen bg-[--color-bg-window] px-6 py-5 text-[--color-text-primary]">
      <div className="mx-auto flex h-full max-w-3xl flex-col rounded-[20px] border border-[--color-border] bg-[--color-bg-content] shadow-md">
        <header className="border-b border-[--color-border] px-6 py-5">
          <h1 className="text-xl font-semibold">Settings</h1>
        </header>

        {isLoading ? (
          <div className="px-6 py-6 text-sm text-[--color-text-secondary]">Loading settings…</div>
        ) : hasError ? (
          <div className="px-6 py-6">
            <p className="text-sm text-[--color-destructive]">Failed to load settings.</p>
            <button
              type="button"
              onClick={() => {
                void appSettingsQuery.refetch();
                void apiKeyStatusQuery.refetch();
              }}
              className="mt-2 text-xs text-[--color-primary] underline underline-offset-4"
            >
              Retry
            </button>
          </div>
        ) : (
          <Tabs defaultValue="translation" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-[--color-border] px-6 py-3">
              <TabsList className="rounded-full bg-[--color-bg-elevated]">
                <TabsTrigger value="general" className="rounded-full">
                  General
                </TabsTrigger>
                <TabsTrigger value="translation" className="rounded-full">
                  Translation
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 px-6 py-6">
              <TabsContent value="general" className="mt-0">
                <GeneralTab />
              </TabsContent>

              <TabsContent value="translation" className="mt-0">
                <TranslationTab
                  configured={apiKeyStatusQuery.data?.configured ?? false}
                  initialModel={appSettingsQuery.data?.llm_model ?? "google/gemini-2.5-flash-lite-preview"}
                  onClearSavedKey={async () => {
                    const shouldClear = await confirm(
                      "Remove the saved API key from Folio?",
                      {
                        kind: "warning",
                        okLabel: "Clear Key",
                        title: "Clear Saved Key",
                      },
                    );

                    if (!shouldClear) {
                      return;
                    }

                    await clearApiKeyMutation.mutateAsync();
                  }}
                  onSave={async ({ apiKey, model }) => {
                    await saveAppSettingsMutation.mutateAsync({ llm_model: model });

                    if (apiKey.trim()) {
                      await saveApiKeyMutation.mutateAsync(apiKey.trim());
                    }
                  }}
                  onTestConnection={({ apiKey, model }) =>
                    testConnectionMutation.mutateAsync({
                      apiKey,
                      model,
                    })
                  }
                  testingConnection={testConnectionMutation.isPending}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>
    </main>
  );
}
