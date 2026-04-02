export interface ParagraphLocator {
  spine_item_href: string;
  paragraph_index: number;
}

export type TranslationJobStatus =
  | "in_progress"
  | "paused"
  | "complete"
  | "cancelled"
  | "failed";

export type TranslationPauseReason = "manual" | "rate_limit" | "network" | "app_restart";

export interface Translation {
  id: string;
  book_id: string;
  spine_item_href: string;
  paragraph_index: number;
  paragraph_hash: string;
  original_html: string;
  translated_html: string;
  target_language: string;
  created_at: number;
}

export interface TranslationJob {
  id: string;
  book_id: string;
  target_language: string;
  status: TranslationJobStatus;
  total_paragraphs: number;
  completed_paragraphs: number;
  failed_paragraph_locators: ParagraphLocator[];
  pause_reason: TranslationPauseReason | null;
  created_at: number;
  updated_at: number;
}
