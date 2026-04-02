import type { TranslationPauseReason } from "@/types/translation";

export interface TranslationProgressEvent {
  job_id: string;
  completed: number;
  total: number;
  latest_spine_item_href: string;
  latest_paragraph_index: number;
}

export interface TranslationCompleteEvent {
  job_id: string;
}

export interface TranslationErrorEvent {
  job_id: string;
  spine_item_href: string;
  paragraph_index: number;
  error_message: string;
}

export interface TranslationPausedEvent {
  job_id: string;
  reason: TranslationPauseReason;
  retry_after_secs?: number;
}

export interface ExportProgressEvent {
  percent: number;
}
