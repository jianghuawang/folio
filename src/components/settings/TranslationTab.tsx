import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
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
  }, [initialModel, reset]);

  const apiKeyValue = watch("api_key");
  const modelValue = watch("model");

  const handleTestConnection = async () => {
    setConnectionResult(null);

    if (!configured && !apiKeyValue.trim()) {
      setError("api_key", {
        message: "API key is required for translation.",
        type: "manual",
      });
      return;
    }

    const result = await onTestConnection({
      apiKey: apiKeyValue.trim() ? apiKeyValue.trim() : null,
      model: modelValue.trim(),
    });
    setConnectionResult(result);
  };

  const handleValidSubmit = async (data: TranslationSettingsForm) => {
    const normalizedApiKey = data.api_key.trim();

    if (!configured && !normalizedApiKey) {
      setError("api_key", {
        message: "API key is required for translation.",
        type: "manual",
      });
      return;
    }

    await onSave({
      apiKey: normalizedApiKey,
      model: data.model.trim(),
    });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(handleValidSubmit)}>
      <div className="space-y-2">
        <p className="text-sm font-medium text-[--color-text-secondary]">API Key Status</p>
        <p className="text-sm text-[--color-text-primary]">
          {configured ? "API key saved" : "No API key saved"}
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
            placeholder={configured ? "Enter a replacement key" : "Paste your API key"}
            className="h-12 rounded-2xl border-[--color-border-strong] bg-[--color-bg-elevated] pr-24 text-[--color-text-primary] placeholder:text-[--color-text-muted]"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((current) => !current)}
            className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-2 rounded-full px-3 py-1 text-sm text-[--color-text-muted] transition hover:bg-white/5 hover:text-[--color-text-primary]"
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showApiKey ? "Hide" : "Show"}</span>
          </button>
        </div>
        {errors.api_key ? (
          <p className="text-xs text-[--color-destructive]">{errors.api_key.message}</p>
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
          <p className="text-xs text-[--color-destructive]">{errors.model.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-[--color-border-strong] bg-transparent px-4 text-[--color-text-primary] hover:bg-white/5"
          onClick={() => void handleTestConnection()}
          disabled={testingConnection}
        >
          {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {testingConnection ? "Testing…" : "Test Connection"}
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

      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={() => void onClearSavedKey()}
          className="text-sm text-[--color-primary] underline underline-offset-4"
        >
          Clear Saved Key
        </button>

        <Button
          type="submit"
          className="min-w-[96px] rounded-full bg-[--color-primary] px-5 text-white hover:brightness-90"
          disabled={isSubmitting}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </form>
  );
}
