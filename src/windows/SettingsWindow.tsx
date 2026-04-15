import { emit } from "@tauri-apps/api/event";
import { confirm } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { TranslationTab } from "@/components/settings/TranslationTab";
import { useApiKeyStatus, useClearApiKey, useSaveApiKey, useTestOpenRouterConnection } from "@/hooks/useApiKeyStatus";
import { useAppSettings, useSaveAppSettings } from "@/hooks/useAppSettings";
import { FolioError } from "@/lib/tauri-commands";

const API_KEY_STATUS_CHANGED_EVENT = "settings:api-key-status-changed";

export default function SettingsWindow() {
  const appSettingsQuery = useAppSettings();
  const saveAppSettingsMutation = useSaveAppSettings();
  const apiKeyStatusQuery = useApiKeyStatus();
  const saveApiKeyMutation = useSaveApiKey();
  const clearApiKeyMutation = useClearApiKey();
  const testConnectionMutation = useTestOpenRouterConnection();
  const refetchAppSettings = appSettingsQuery.refetch;
  const refetchApiKeyStatus = apiKeyStatusQuery.refetch;

  const isLoading = appSettingsQuery.isLoading || apiKeyStatusQuery.isLoading;
  const hasError = appSettingsQuery.error || apiKeyStatusQuery.error;

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    let unlistenFocus: (() => void) | null = null;

    void currentWindow
      .onFocusChanged(({ payload }) => {
        if (payload) {
          void refetchAppSettings();
          void refetchApiKeyStatus();
        }
      })
      .then((unlisten) => {
        unlistenFocus = unlisten;
      });

    return () => {
      unlistenFocus?.();
    };
  }, [refetchApiKeyStatus, refetchAppSettings]);

  return (
    <main className="h-screen overflow-hidden bg-[--color-bg-window] px-6 py-5 text-[--color-text-primary]">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-[20px] border border-[--color-border] bg-[--color-bg-content] shadow-md">
        <header className="border-b border-[--color-border] px-6 py-5">
          <h1 className="text-xl font-semibold">Settings</h1>
        </header>

        {isLoading ? (
          <div className="flex flex-1 flex-col gap-6 px-6 py-6">
            <div className="h-10 w-[236px] animate-pulse rounded-full bg-[--color-bg-elevated]" />
            <div className="space-y-6 rounded-[20px] border border-[--color-border] bg-[--color-bg-surface] px-5 py-6">
              <div className="space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-[--color-bg-elevated]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[--color-bg-elevated]" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-[--color-bg-elevated]" />
                <div className="h-12 w-full animate-pulse rounded-2xl bg-[--color-bg-elevated]" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-14 animate-pulse rounded bg-[--color-bg-elevated]" />
                <div className="h-12 w-full animate-pulse rounded-2xl bg-[--color-bg-elevated]" />
              </div>
              <div className="h-10 w-40 animate-pulse rounded-full bg-[--color-bg-elevated]" />
            </div>
          </div>
        ) : hasError ? (
          <div className="flex flex-1 items-center justify-center px-6 py-6">
            <div className="w-full max-w-md rounded-[20px] border border-[--color-border] bg-[--color-bg-surface] px-5 py-6">
              <p className="text-sm text-[--color-destructive]">Failed to load settings.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void appSettingsQuery.refetch();
                  void apiKeyStatusQuery.refetch();
                }}
                className="mt-4 rounded-full border-[--color-border-strong] bg-transparent text-[--color-text-primary] hover:bg-white/5"
              >
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="translation" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-[--color-border] px-6 py-3">
              <TabsList className="h-auto rounded-full bg-[--color-bg-elevated] p-1">
                <TabsTrigger
                  value="general"
                  className="min-w-[108px] rounded-full px-4 py-2 text-sm text-[--color-text-muted] data-[state=active]:bg-[--color-bg-window] data-[state=active]:text-[--color-text-primary] data-[state=active]:shadow-none"
                >
                  General
                </TabsTrigger>
                <TabsTrigger
                  value="translation"
                  className="min-w-[108px] rounded-full px-4 py-2 text-sm text-[--color-text-muted] data-[state=active]:bg-[--color-bg-window] data-[state=active]:text-[--color-text-primary] data-[state=active]:shadow-none"
                >
                  Translation
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
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
                    await emit(API_KEY_STATUS_CHANGED_EVENT, { configured: false });
                  }}
                  onSave={async ({ apiKey, model }) => {
                    await saveAppSettingsMutation.mutateAsync({ llm_model: model });

                    if (apiKey.trim()) {
                      await saveApiKeyMutation.mutateAsync(apiKey.trim());
                      const { data } = await refetchApiKeyStatus();
                      if (!data?.configured) {
                        throw new FolioError(
                          "SECURE_STORAGE_ERROR",
                          "API key could not be verified after saving.",
                        );
                      }

                      await emit(API_KEY_STATUS_CHANGED_EVENT, { configured: true });
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
