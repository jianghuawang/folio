import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";

import {
  cancelTranslation,
  exportBilingualEpub,
  FolioError,
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
import type { TranslationJob } from "@/types/translation";

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
  const activeJobIdRef = useRef<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [progressEvent, setProgressEvent] = useState<TranslationProgressEvent | null>(null);
  const [pausedEvent, setPausedEvent] = useState<TranslationPausedEvent | null>(null);
  const [latestError, setLatestError] = useState<TranslationErrorEvent | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  const setTrackedJobId = useCallback((jobId: string | null) => {
    activeJobIdRef.current = jobId;
    setActiveJobId(jobId);
  }, []);

  const targetLanguage = currentLanguage ?? null;

  const invalidateTranslationQueries = useCallback(
    async (language: string | null = targetLanguage) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["translation-language", bookId] }),
        queryClient.invalidateQueries({ queryKey: ["translation-job", bookId] }),
        queryClient.invalidateQueries({ queryKey: ["translations", bookId] }),
      ];

      if (language) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ["translation-job", bookId, language] }),
          queryClient.invalidateQueries({ queryKey: ["translations", bookId, language] }),
        );
      }

      await Promise.all(invalidations);
    },
    [bookId, queryClient, targetLanguage],
  );

  const cacheJob = useCallback(
    (job: TranslationJob) => {
      if (!bookId) {
        return;
      }

      queryClient.setQueryData(["translation-language", bookId], job.target_language);
      queryClient.setQueryData(["translation-job", bookId, job.target_language], job);
    },
    [bookId, queryClient],
  );

  const activateLanguage = useCallback(
    async (language: string) => {
      setStartError(null);
      setCurrentLanguage(language);
      setBilingualMode(true);
      await invalidateTranslationQueries(language);
    },
    [invalidateTranslationQueries, setBilingualMode, setCurrentLanguage],
  );

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

  const resolvedTargetLanguage = currentLanguage ?? availableLanguageQuery.data ?? null;

  const jobQuery = useQuery({
    queryKey: ["translation-job", bookId, resolvedTargetLanguage],
    enabled: Boolean(bookId && resolvedTargetLanguage),
    queryFn: () => getTranslationJob(bookId as string, resolvedTargetLanguage as string),
  });

  const translationsQuery = useQuery({
    queryKey: ["translations", bookId, resolvedTargetLanguage],
    enabled: Boolean(bookId && resolvedTargetLanguage),
    queryFn: () => getTranslations(bookId as string, resolvedTargetLanguage as string),
  });

  useEffect(() => {
    if (!currentLanguage && availableLanguageQuery.data) {
      setCurrentLanguage(availableLanguageQuery.data);
      setBilingualMode(true);
    }
  }, [availableLanguageQuery.data, currentLanguage, setBilingualMode, setCurrentLanguage]);

  useEffect(() => {
    setTrackedJobId(jobQuery.data?.id ?? null);
  }, [jobQuery.data?.id, setTrackedJobId]);

  useEffect(() => {
    setProgressEvent(null);
    setPausedEvent(null);
    setLatestError(null);
    setRetryCountdown(null);
  }, [activeJobId]);

  useEffect(() => {
    setStartError(null);
    setTrackedJobId(null);
    setProgressEvent(null);
    setPausedEvent(null);
    setLatestError(null);
    setRetryCountdown(null);
  }, [bookId, setTrackedJobId]);

  const effectivePausedEvent =
    pausedEvent && jobQuery.data && pausedEvent.job_id === jobQuery.data.id ? pausedEvent : null;

  useEffect(() => {
    const job = jobQuery.data;
    const pauseReason = effectivePausedEvent?.reason ?? job?.pause_reason;
    const initialCountdown = effectivePausedEvent?.retry_after_secs ?? 30;

    if (job?.status !== "paused" || pauseReason !== "rate_limit") {
      setRetryCountdown(null);
      return undefined;
    }

    setRetryCountdown(initialCountdown);

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
  }, [effectivePausedEvent?.reason, effectivePausedEvent?.retry_after_secs, jobQuery.data]);

  useEffect(() => {
    if (!bookId) {
      return undefined;
    }

    let active = true;
    let cleanup: (() => void) | undefined;

    const registerListeners = async () => {
      const unlistenProgress = await listen<TranslationProgressEvent>(
        "translation:progress",
        (event) => {
          const trackedJobId = activeJobIdRef.current;
          if (!active || !trackedJobId || event.payload.job_id !== trackedJobId) {
            return;
          }

          setProgressEvent(event.payload);
          void invalidateTranslationQueries(resolvedTargetLanguage);
        },
      );

      const unlistenComplete = await listen<TranslationCompleteEvent>(
        "translation:complete",
        (event) => {
          const trackedJobId = activeJobIdRef.current;
          if (!active || !trackedJobId || event.payload.job_id !== trackedJobId) {
            return;
          }

          void invalidateTranslationQueries(resolvedTargetLanguage);
        },
      );

      const unlistenError = await listen<TranslationErrorEvent>("translation:error", (event) => {
        const trackedJobId = activeJobIdRef.current;
        if (!active || !trackedJobId || event.payload.job_id !== trackedJobId) {
          return;
        }

        setLatestError(event.payload);
        void invalidateTranslationQueries(resolvedTargetLanguage);
      });

      const unlistenPaused = await listen<TranslationPausedEvent>("translation:paused", (event) => {
        const trackedJobId = activeJobIdRef.current;
        if (!active || !trackedJobId || event.payload.job_id !== trackedJobId) {
          return;
        }

        setPausedEvent(event.payload);
        void invalidateTranslationQueries(resolvedTargetLanguage);
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

    void registerListeners().then((nextCleanup) => {
      cleanup = nextCleanup;
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [bookId, invalidateTranslationQueries, resolvedTargetLanguage]);

  const startMutation = useMutation({
    mutationFn: (payload: { language: string; replaceExisting?: boolean }) =>
      startTranslation(bookId as string, payload.language, payload.replaceExisting),
    onMutate: () => {
      setStartError(null);
    },
    onSuccess: async (job) => {
      setTrackedJobId(job.id);
      cacheJob(job);
      await activateLanguage(job.target_language);
    },
    onError: (error) => {
      if (!(error instanceof FolioError)) {
        setStartError("Failed to start translation.");
        return;
      }

      if (error.code === "JOB_ALREADY_EXISTS" || error.code === "TRANSLATION_ALREADY_COMPLETE") {
        return;
      }

      if (error.code === "NO_API_KEY") {
        setStartError("Translation requires a saved API key in Settings.");
        return;
      }

      if (error.code === "KEYCHAIN_ERROR") {
        setStartError("Unable to access macOS Keychain. Please try again.");
        return;
      }

      if (error.code === "TRANSLATION_FAILED") {
        setStartError("This book could not be prepared for translation.");
        return;
      }

      setStartError("Failed to start translation.");
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => pauseTranslation(jobQuery.data?.id as string),
    onSuccess: async (job) => {
      cacheJob(job);
      setTrackedJobId(job.id);
      await invalidateTranslationQueries(job.target_language);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeTranslation(jobQuery.data?.id as string),
    onSuccess: async (job) => {
      cacheJob(job);
      setTrackedJobId(job.id);
      setPausedEvent(null);
      await invalidateTranslationQueries(job.target_language);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelTranslation(jobQuery.data?.id as string),
    onSuccess: async () => {
      setPausedEvent(null);
      await invalidateTranslationQueries(resolvedTargetLanguage);
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => retryFailedParagraphs(jobQuery.data?.id as string),
    onSuccess: async (job) => {
      cacheJob(job);
      setTrackedJobId(job.id);
      setLatestError(null);
      setPausedEvent(null);
      await invalidateTranslationQueries(job.target_language);
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!bookId || !resolvedTargetLanguage) {
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

      await exportBilingualEpub(bookId, resolvedTargetLanguage, savePath);
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

    const pauseReason = effectivePausedEvent?.reason ?? job.pause_reason;

    if (job.status === "paused" && pauseReason === "app_restart") {
      return `Continue translating '${bookTitle}'?`;
    }

    if (job.status === "paused" && pauseReason === "rate_limit") {
      const seconds = retryCountdown ?? effectivePausedEvent?.retry_after_secs ?? 30;
      return `Translation paused (rate limit reached). Will retry in ${seconds}s.`;
    }

    if (job.status === "paused" && pauseReason === "network") {
      return "Translation paused (no internet connection).";
    }

    if (job.status === "paused") {
      return "Translation paused.";
    }

    if (job.status === "in_progress") {
      return `Translating · ${progressEvent?.completed ?? job.completed_paragraphs} of ${progressEvent?.total ?? job.total_paragraphs} paragraphs complete`;
    }

    if (job.status === "complete") {
      if (job.failed_paragraph_locators.length > 0) {
        return `${job.failed_paragraph_locators.length} paragraphs could not be translated.`;
      }

      return "Translation complete.";
    }

    return null;
  }, [bookTitle, effectivePausedEvent, jobQuery.data, progressEvent, retryCountdown]);

  return {
    availableLanguages: TRANSLATION_LANGUAGES,
    bilingualMode,
    canExport,
    currentLanguage: resolvedTargetLanguage,
    activateLanguage,
    clearStartError: () => setStartError(null),
    exportMutation,
    exportProgress,
    job: jobQuery.data ?? null,
    latestError,
    pausedEvent,
    progressEvent,
    retryMutation,
    setBilingualMode,
    setCurrentLanguage,
    startError,
    startMutation,
    translations: translationsQuery.data ?? [],
    translationsQuery,
    statusMessage,
    pauseMutation,
    resumeMutation,
    cancelMutation,
  };
}
