import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolioError } from "@/lib/tauri-commands";
import type { ConnectionTestResult } from "@/types/settings";

const TranslationSettingsSchema = z.object({
  api_key: z.string(),
  model: z.string().trim().min(1, "Model is required."),
});

type TranslationSettingsForm = z.infer<typeof TranslationSettingsSchema>;

interface TranslationTabProps {
  configured: boolean;
  initialModel: string;
  onClearSavedKey: () => Promise<void>;
  onSave: (payload: { apiKey: string; model: string }) => Promise<void>;
  onTestConnection: (payload: {
    apiKey: string | null;
    model: string;
  }) => Promise<ConnectionTestResult>;
  testingConnection?: boolean;
}

function getSettingsErrorMessage(error: unknown): string {
  if (error instanceof FolioError) {
    if (error.code === "API_KEY_REQUIRED") {
      return "API key is required for translation.";
    }

    if (error.code === "KEYCHAIN_ERROR") {
      return "Unable to access macOS Keychain. Please try again.";
    }

    if (error.code === "SQLITE_LOCK_ERROR") {
      return "Settings are temporarily unavailable. Please try again.";
    }
  }

  return "Something went wrong. Please try again.";
}

export function TranslationTab({
  configured,
  initialModel,
  onClearSavedKey,
  onSave,
  onTestConnection,
  testingConnection = false,
}: TranslationTabProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isClearingKey, setIsClearingKey] = useState(false);
  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
    trigger,
    watch,
  } = useForm<TranslationSettingsForm>({
    defaultValues: {
      api_key: "",
      model: initialModel,
    },
    mode: "onBlur",
    resolver: zodResolver(TranslationSettingsSchema),
  });

  useEffect(() => {
    reset({
      api_key: "",
      model: initialModel,
    });
    setConnectionResult(null);
    setActionError(null);
  }, [initialModel, reset]);

  const apiKeyValue = watch("api_key");
  const modelValue = watch("model");
  const hasDraftApiKey = apiKeyValue.trim().length > 0;

  useEffect(() => {
    setConnectionResult(null);
    setActionError(null);
  }, [apiKeyValue, modelValue]);

  useEffect(() => {
    if (configured || hasDraftApiKey) {
      clearErrors("api_key");
    }
  }, [clearErrors, configured, hasDraftApiKey]);

  const apiKeyPlaceholder = useMemo(() => {
    if (configured) {
      return "••••••••••••••••••••••••";
    }

    return "Paste your API key";
  }, [configured]);

  const handleTestConnection = async () => {
    setActionError(null);
    setConnectionResult(null);

    const isModelValid = await trigger("model");
    if (!isModelValid) {
      return;
    }

    if (!configured && !apiKeyValue.trim()) {
      setError("api_key", {
        message: "API key is required for translation.",
        type: "manual",
      });
      return;
    }

    try {
      const result = await onTestConnection({
        apiKey: apiKeyValue.trim() ? apiKeyValue.trim() : null,
        model: modelValue.trim(),
      });
      setConnectionResult(result);
    } catch (error) {
      setConnectionResult({
        success: false,
        error: getSettingsErrorMessage(error),
      });
    }
  };

  const handleValidSubmit = async (data: TranslationSettingsForm) => {
    setActionError(null);
    const normalizedApiKey = data.api_key.trim();

    if (!configured && !normalizedApiKey) {
      setError("api_key", {
        message: "API key is required for translation.",
        type: "manual",
      });
      return;
    }

    try {
      await onSave({
        apiKey: normalizedApiKey,
        model: data.model.trim(),
      });
    } catch (error) {
      setActionError(getSettingsErrorMessage(error));
    }
  };

  const handleClearSavedKey = async () => {
    setActionError(null);
    setConnectionResult(null);
    setIsClearingKey(true);

    try {
      await onClearSavedKey();
    } catch (error) {
      setActionError(getSettingsErrorMessage(error));
    } finally {
      setIsClearingKey(false);
    }
  };

  return (
    <form className="max-w-[420px] space-y-6" onSubmit={handleSubmit(handleValidSubmit)}>
      <div className="space-y-2">
        <p className="text-sm font-medium text-[--color-text-secondary]">API Key Status</p>
        <p className="text-sm text-[--color-text-primary]">
          {configured ? "Saved" : "Not saved"}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[--color-text-secondary]" htmlFor="api-key">
          OpenRouter API Key
        </label>
        <div className="relative">
          <Input
            id="api-key"
            type={showApiKey ? "text" : "password"}
            {...register("api_key")}
            placeholder={apiKeyPlaceholder}
            className="h-12 rounded-2xl border-[--color-border-strong] bg-[--color-bg-elevated] pr-24 text-[--color-text-primary] placeholder:text-[--color-text-muted]"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((current) => !current)}
            aria-label={showApiKey ? "Hide API key" : "Show API key"}
            className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-2 rounded-full px-3 py-1 text-sm text-[--color-text-muted] transition hover:bg-white/5 hover:text-[--color-text-primary]"
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showApiKey ? "Hide" : "Show"}</span>
          </button>
        </div>
        {errors.api_key ? (
          <p className="flex items-center gap-2 text-xs text-[--color-destructive]" role="alert">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{errors.api_key.message}</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[--color-text-secondary]" htmlFor="model">
          Model
        </label>
        <Input
          id="model"
          {...register("model")}
          className="h-12 rounded-2xl border-[--color-border-strong] bg-[--color-bg-elevated] text-[--color-text-primary]"
        />
        {errors.model ? (
          <p className="flex items-center gap-2 text-xs text-[--color-destructive]" role="alert">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{errors.model.message}</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="min-w-[154px] rounded-full border-[--color-border-strong] bg-transparent px-4 text-[--color-text-primary] hover:bg-white/5"
          onClick={() => void handleTestConnection()}
          disabled={testingConnection || isSubmitting || isClearingKey}
        >
          {testingConnection ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="sr-only">Testing connection</span>
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
        {connectionResult ? (
          connectionResult.success ? (
            <p className="text-sm text-[--color-success]">✓ Connection successful</p>
          ) : (
            <p className="text-sm text-[--color-destructive]">
              ✗ Error: {connectionResult.error}
            </p>
          )
        ) : null}
      </div>

      {actionError ? (
        <p className="text-sm text-[--color-destructive]" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="flex items-center justify-between pt-2">
        {configured ? (
          <button
            type="button"
            onClick={() => void handleClearSavedKey()}
            className="text-sm text-[--color-primary] underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isSubmitting || testingConnection || isClearingKey}
          >
            {isClearingKey ? "Clearing…" : "Clear Saved Key"}
          </button>
        ) : (
          <span />
        )}

        <Button
          type="submit"
          className="min-w-[96px] rounded-full bg-[--color-primary] px-5 text-white hover:brightness-90"
          disabled={isSubmitting || testingConnection || isClearingKey}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="sr-only">Saving settings</span>
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </form>
  );
}
