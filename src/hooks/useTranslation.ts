import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";

import {
  cancelTranslation,
  exportBilingualEpub,
  getTranslationJob,
  getTranslations,
  pauseTranslation,
  retryFailedParagraphs,
  resumeTranslation,
  startTranslation,
} from "@/lib/tauri-commands";
import { useReaderStore } from "@/store/readerStore";
import type {
  ExportProgressEvent,
  TranslationCompleteEvent,
  TranslationErrorEvent,
  TranslationPausedEvent,
  TranslationProgressEvent,
} from "@/types/events";

const TRANSLATION_LANGUAGES = [
  "English",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "Japanese",
  "Korean",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Arabic",
  "Russian",
] as const;

function slugifyFileName(value: string, fallback: string) {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");

  return normalized.length > 0 ? normalized : fallback;
}

export function useTranslation(bookId: string | null, bookTitle: string) {
  const queryClient = useQueryClient();
  const bilingualMode = useReaderStore((state) => state.bilingualMode);
  const currentLanguage = useReaderStore((state) => state.currentLanguage);
  const setBilingualMode = useReaderStore((state) => state.setBilingualMode);
  const setCurrentLanguage = useReaderStore((state) => state.setCurrentLanguage);
  const [progressEvent, setProgressEvent] = useState<TranslationProgressEvent | null>(null);
  const [pausedEvent, setPausedEvent] = useState<TranslationPausedEvent | null>(null);
  const [latestError, setLatestError] = useState<TranslationErrorEvent | null>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  const availableLanguageQuery = useQuery({
    queryKey: ["translation-language", bookId],
    enabled: Boolean(bookId),
    queryFn: async () => {
      for (const language of TRANSLATION_LANGUAGES) {
        const job = await getTranslationJob(bookId as string, language);
        if (job) {
          return job.target_language;
        }
      }

      return null;
    },
  });

  const targetLanguage = currentLanguage ?? availableLanguageQuery.data ?? null;

  const jobQuery = useQuery({
    queryKey: ["translation-job", bookId, targetLanguage],
    enabled: Boolean(bookId && targetLanguage),
    queryFn: () => getTranslationJob(bookId as string, targetLanguage as string),
  });

  const translationsQuery = useQuery({
    queryKey: ["translations", bookId, targetLanguage],
    enabled: Boolean(bookId && targetLanguage),
    queryFn: () => getTranslations(bookId as string, targetLanguage as string),
  });

  useEffect(() => {
    if (!currentLanguage && availableLanguageQuery.data) {
      setCurrentLanguage(availableLanguageQuery.data);
      setBilingualMode(true);
    }
  }, [availableLanguageQuery.data, currentLanguage, setBilingualMode, setCurrentLanguage]);

  useEffect(() => {
    if (
      jobQuery.data?.status !== "paused" ||
      pausedEvent?.reason !== "rate_limit" ||
      !pausedEvent.retry_after_secs
    ) {
      setRetryCountdown(null);
      return undefined;
    }

    setRetryCountdown(pausedEvent.retry_after_secs);

    const intervalId = window.setInterval(() => {
      setRetryCountdown((currentValue) => {
        if (currentValue === null || currentValue <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }

        return currentValue - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [jobQuery.data?.status, pausedEvent]);

  useEffect(() => {
    if (!bookId) {
      return undefined;
    }

    let active = true;

    const invalidateTranslationQueries = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["translation-language", bookId] }),
        queryClient.invalidateQueries({ queryKey: ["translation-job", bookId] }),
        queryClient.invalidateQueries({ queryKey: ["translations", bookId] }),
      ]);
    };

    const jobId = jobQuery.data?.id ?? null;

    const registerListeners = async () => {
      const unlistenProgress = await listen<TranslationProgressEvent>(
        "translation:progress",
        (event) => {
          if (!active || (jobId && event.payload.job_id !== jobId)) {
            return;
          }

          setProgressEvent(event.payload);
          invalidateTranslationQueries();
        },
      );

      const unlistenComplete = await listen<TranslationCompleteEvent>(
        "translation:complete",
        (event) => {
          if (!active || (jobId && event.payload.job_id !== jobId)) {
            return;
          }

          invalidateTranslationQueries();
        },
      );

      const unlistenError = await listen<TranslationErrorEvent>("translation:error", (event) => {
        if (!active || (jobId && event.payload.job_id !== jobId)) {
          return;
        }

        setLatestError(event.payload);
        invalidateTranslationQueries();
      });

      const unlistenPaused = await listen<TranslationPausedEvent>("translation:paused", (event) => {
        if (!active || (jobId && event.payload.job_id !== jobId)) {
          return;
        }

        setPausedEvent(event.payload);
        invalidateTranslationQueries();
      });

      const unlistenExportProgress = await listen<ExportProgressEvent>("export:progress", (event) => {
        if (!active) {
          return;
        }

        setExportProgress(event.payload.percent);
      });

      return () => {
        unlistenProgress();
        unlistenComplete();
        unlistenError();
        unlistenPaused();
        unlistenExportProgress();
      };
    };

    let cleanup: (() => void) | undefined;

    void registerListeners().then((nextCleanup) => {
      cleanup = nextCleanup;
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [bookId, jobQuery.data?.id, queryClient]);

  const startMutation = useMutation({
    mutationFn: (payload: { language: string; replaceExisting?: boolean }) =>
      startTranslation(bookId as string, payload.language, payload.replaceExisting),
    onSuccess: async (job) => {
      setCurrentLanguage(job.target_language);
      setBilingualMode(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["translation-language", bookId] }),
        queryClient.invalidateQueries({ queryKey: ["translation-job", bookId, job.target_language] }),
        queryClient.invalidateQueries({ queryKey: ["translations", bookId, job.target_language] }),
      ]);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => pauseTranslation(jobQuery.data?.id as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["translation-job", bookId, targetLanguage] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeTranslation(jobQuery.data?.id as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["translation-job", bookId, targetLanguage] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelTranslation(jobQuery.data?.id as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["translation-job", bookId, targetLanguage] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => retryFailedParagraphs(jobQuery.data?.id as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["translation-job", bookId, targetLanguage] });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!bookId || !targetLanguage) {
        return false;
      }

      const defaultPath = `~/Desktop/${slugifyFileName(bookTitle, "folio_book")}_bilingual.epub`;
      const savePath = await save({
        defaultPath,
        filters: [
          {
            name: "ePub",
            extensions: ["epub"],
          },
        ],
        title: "Export Bilingual ePub",
      });

      if (!savePath) {
        return false;
      }

      await exportBilingualEpub(bookId, targetLanguage, savePath);
      return true;
    },
    onMutate: () => {
      setExportProgress(0);
    },
    onSettled: () => {
      setExportProgress(null);
    },
  });

  const canExport = Boolean(
    jobQuery.data &&
      jobQuery.data.status === "complete" &&
      jobQuery.data.completed_paragraphs >= jobQuery.data.total_paragraphs,
  );

  const statusMessage = useMemo(() => {
    const job = jobQuery.data;
    if (!job) {
      return null;
    }

    if (job.status === "paused" && job.pause_reason === "app_restart") {
      return `Continue translating '${bookTitle}'?`;
    }

    if (job.status === "paused" && pausedEvent?.reason === "rate_limit") {
      return `Translation paused (rate limit reached). Will retry in ${retryCountdown ?? pausedEvent.retry_after_secs ?? 30}s.`;
    }

    if (job.status === "paused" && pausedEvent?.reason === "network") {
      return "Translation paused (no internet connection).";
    }

    if (job.status === "paused") {
      return "Translation paused.";
    }

    if (job.status === "in_progress") {
      return `Translating · ${progressEvent?.completed ?? job.completed_paragraphs} of ${progressEvent?.total ?? job.total_paragraphs} paragraphs complete`;
    }

    if (job.status === "complete") {
      return "Translation complete.";
    }

    return null;
  }, [bookTitle, jobQuery.data, pausedEvent, progressEvent, retryCountdown]);

  return {
    availableLanguages: TRANSLATION_LANGUAGES,
    bilingualMode,
    canExport,
    currentLanguage: targetLanguage,
    exportMutation,
    exportProgress,
    job: jobQuery.data ?? null,
    latestError,
    pausedEvent,
    progressEvent,
    retryMutation,
    setBilingualMode,
    setCurrentLanguage,
    startMutation,
    translations: translationsQuery.data ?? [],
    translationsQuery,
    statusMessage,
    pauseMutation,
    resumeMutation,
    cancelMutation,
  };
}
