import { invoke } from "@tauri-apps/api/core";

import type { Highlight, HighlightColor, Note } from "@/types/annotation";
import type { Book, ImportBookResult, LibraryFilter } from "@/types/book";
import type {
  ApiKeyStatus,
  AppSettings,
  ConnectionTestResult,
  ReadingSettings,
  ReadingSettingsUpdate,
} from "@/types/settings";
import type { Translation, TranslationJob } from "@/types/translation";

export class FolioError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "FolioError";
  }
}

function resolveErrorCode(error: unknown): string {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "UNKNOWN_ERROR";
}

function resolveErrorMessage(command: string, error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return `Failed to invoke ${command}: ${error.message}`;
  }

  if (typeof error === "string" && error.length > 0) {
    return `Failed to invoke ${command}: ${error}`;
  }

  return `Failed to invoke ${command}.`;
}

export async function invokeTauri<ReturnType>(
  command: string,
  args?: Record<string, unknown>,
): Promise<ReturnType> {
  try {
    return await invoke<ReturnType>(command, args);
  } catch (error) {
    throw new FolioError(resolveErrorCode(error), resolveErrorMessage(command, error));
  }
}

export async function importBooks(filePaths: string[]): Promise<ImportBookResult> {
  try {
    return await invokeTauri<ImportBookResult>("import_book", { filePaths });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("IMPORT_BOOK_FAILED", `Failed to import books: ${String(error)}`);
  }
}

export async function getBooks(filter: LibraryFilter): Promise<Book[]> {
  try {
    return await invokeTauri<Book[]>("get_books", { filter });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("GET_BOOKS_FAILED", `Failed to load books: ${String(error)}`);
  }
}

export async function getBook(bookId: string): Promise<Book> {
  try {
    return await invokeTauri<Book>("get_book", { bookId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("GET_BOOK_FAILED", `Failed to load book: ${String(error)}`);
  }
}

export async function deleteBook(bookId: string): Promise<void> {
  try {
    await invokeTauri<void>("delete_book", { bookId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("DELETE_BOOK_FAILED", `Failed to delete book: ${String(error)}`);
  }
}

export async function openReaderWindow(bookId: string): Promise<void> {
  try {
    await invokeTauri<void>("open_reader_window", { bookId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "OPEN_READER_WINDOW_FAILED",
      `Failed to open reader window: ${String(error)}`,
    );
  }
}

export async function saveReadingPosition(
  bookId: string,
  cfi: string,
  progress: number,
): Promise<void> {
  try {
    await invokeTauri<void>("save_reading_position", {
      bookId,
      cfi,
      progress,
    });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "SAVE_READING_POSITION_FAILED",
      `Failed to save reading position: ${String(error)}`,
    );
  }
}

export async function getReadingSettings(bookId: string): Promise<ReadingSettings> {
  try {
    return await invokeTauri<ReadingSettings>("get_reading_settings", {
      bookId,
    });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "GET_READING_SETTINGS_FAILED",
      `Failed to load reading settings: ${String(error)}`,
    );
  }
}

export async function updateReadingSettings(
  bookId: string,
  settings: ReadingSettingsUpdate,
): Promise<ReadingSettings> {
  try {
    return await invokeTauri<ReadingSettings>("update_reading_settings", {
      bookId,
      settings,
    });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "UPDATE_READING_SETTINGS_FAILED",
      `Failed to update reading settings: ${String(error)}`,
    );
  }
}

export async function getHighlights(bookId: string): Promise<Highlight[]> {
  try {
    return await invokeTauri<Highlight[]>("get_highlights", { bookId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "GET_HIGHLIGHTS_FAILED",
      `Failed to load highlights: ${String(error)}`,
    );
  }
}

export async function addHighlight(
  bookId: string,
  cfiRange: string,
  color: HighlightColor,
  textExcerpt: string,
): Promise<Highlight> {
  try {
    return await invokeTauri<Highlight>("add_highlight", {
      bookId,
      cfiRange,
      color,
      textExcerpt,
    });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("ADD_HIGHLIGHT_FAILED", `Failed to add highlight: ${String(error)}`);
  }
}

export async function updateHighlight(id: string, color: HighlightColor): Promise<Highlight> {
  try {
    return await invokeTauri<Highlight>("update_highlight", { id, color });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "UPDATE_HIGHLIGHT_FAILED",
      `Failed to update highlight: ${String(error)}`,
    );
  }
}

export async function deleteHighlight(id: string): Promise<void> {
  try {
    await invokeTauri<void>("delete_highlight", { id });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "DELETE_HIGHLIGHT_FAILED",
      `Failed to delete highlight: ${String(error)}`,
    );
  }
}

export async function getNotes(bookId: string): Promise<Note[]> {
  try {
    return await invokeTauri<Note[]>("get_notes", { bookId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("GET_NOTES_FAILED", `Failed to load notes: ${String(error)}`);
  }
}

export async function saveNote(
  bookId: string,
  highlightId: string | null,
  cfi: string,
  textExcerpt: string,
  body: string,
): Promise<Note> {
  try {
    return await invokeTauri<Note>("save_note", {
      bookId,
      highlightId,
      cfi,
      textExcerpt,
      body,
    });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("SAVE_NOTE_FAILED", `Failed to save note: ${String(error)}`);
  }
}

export async function updateNote(id: string, body: string): Promise<Note | null> {
  try {
    return await invokeTauri<Note | null>("update_note", { id, body });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("UPDATE_NOTE_FAILED", `Failed to update note: ${String(error)}`);
  }
}

export async function deleteNote(id: string): Promise<void> {
  try {
    await invokeTauri<void>("delete_note", { id });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("DELETE_NOTE_FAILED", `Failed to delete note: ${String(error)}`);
  }
}

export async function exportHighlights(bookId: string, savePath: string): Promise<void> {
  try {
    await invokeTauri<void>("export_highlights", {
      bookId,
      savePath,
    });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "EXPORT_HIGHLIGHTS_FAILED",
      `Failed to export highlights: ${String(error)}`,
    );
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  try {
    return await invokeTauri<AppSettings>("get_app_settings");
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "GET_APP_SETTINGS_FAILED",
      `Failed to load app settings: ${String(error)}`,
    );
  }
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  try {
    return await invokeTauri<AppSettings>("save_app_settings", { settings });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "SAVE_APP_SETTINGS_FAILED",
      `Failed to save app settings: ${String(error)}`,
    );
  }
}

export async function saveApiKey(apiKey: string): Promise<void> {
  try {
    await invokeTauri<void>("save_api_key", { apiKey });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("SAVE_API_KEY_FAILED", `Failed to save API key: ${String(error)}`);
  }
}

export async function hasApiKey(): Promise<ApiKeyStatus> {
  try {
    return await invokeTauri<ApiKeyStatus>("has_api_key");
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "HAS_API_KEY_FAILED",
      `Failed to check API key status: ${String(error)}`,
    );
  }
}

export async function clearApiKey(): Promise<void> {
  try {
    await invokeTauri<void>("clear_api_key");
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("CLEAR_API_KEY_FAILED", `Failed to clear API key: ${String(error)}`);
  }
}

function normalizeConnectionTestErrorMessage(message: string): string {
  if (message === "Invalid API key.") {
    return "401 Unauthorized. Check your API key.";
  }

  return message;
}

export async function testOpenRouterConnection(
  apiKey: string | null,
  model: string,
): Promise<ConnectionTestResult> {
  try {
    const result = await invokeTauri<ConnectionTestResult>("test_openrouter_connection", {
      apiKey,
      model,
    });

    if (!result.success) {
      return {
        success: false,
        error: normalizeConnectionTestErrorMessage(result.error),
      };
    }

    return result;
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "TEST_OPENROUTER_CONNECTION_FAILED",
      `Failed to test OpenRouter connection: ${String(error)}`,
    );
  }
}

export async function startTranslation(
  bookId: string,
  targetLanguage: string,
  replaceExisting?: boolean,
): Promise<TranslationJob> {
  try {
    return await invokeTauri<TranslationJob>("start_translation", {
      bookId,
      targetLanguage,
      replaceExisting,
    });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "START_TRANSLATION_FAILED",
      `Failed to start translation: ${String(error)}`,
    );
  }
}

export async function pauseTranslation(jobId: string): Promise<TranslationJob> {
  try {
    return await invokeTauri<TranslationJob>("pause_translation", { jobId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "PAUSE_TRANSLATION_FAILED",
      `Failed to pause translation: ${String(error)}`,
    );
  }
}

export async function resumeTranslation(jobId: string): Promise<TranslationJob> {
  try {
    return await invokeTauri<TranslationJob>("resume_translation", { jobId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "RESUME_TRANSLATION_FAILED",
      `Failed to resume translation: ${String(error)}`,
    );
  }
}

export async function cancelTranslation(jobId: string): Promise<void> {
  try {
    await invokeTauri<void>("cancel_translation", { jobId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "CANCEL_TRANSLATION_FAILED",
      `Failed to cancel translation: ${String(error)}`,
    );
  }
}

export async function getTranslations(
  bookId: string,
  targetLanguage: string,
): Promise<Translation[]> {
  try {
    return await invokeTauri<Translation[]>("get_translations", {
      bookId,
      targetLanguage,
    });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "GET_TRANSLATIONS_FAILED",
      `Failed to load translations: ${String(error)}`,
    );
  }
}

export async function getTranslationJob(
  bookId: string,
  targetLanguage: string,
): Promise<TranslationJob | null> {
  try {
    return await invokeTauri<TranslationJob | null>("get_translation_job", {
      bookId,
      targetLanguage,
    });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "GET_TRANSLATION_JOB_FAILED",
      `Failed to load translation job: ${String(error)}`,
    );
  }
}

export async function retryFailedParagraphs(jobId: string): Promise<TranslationJob> {
  try {
    return await invokeTauri<TranslationJob>("retry_failed_paragraphs", { jobId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "RETRY_FAILED_PARAGRAPHS_FAILED",
      `Failed to retry failed paragraphs: ${String(error)}`,
    );
  }
}

export async function exportBilingualEpub(
  bookId: string,
  targetLanguage: string,
  savePath: string,
): Promise<void> {
  try {
    await invokeTauri<void>("export_bilingual_epub", {
      bookId,
      targetLanguage,
      savePath,
    });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError(
      "EXPORT_BILINGUAL_EPUB_FAILED",
      `Failed to export bilingual ePub: ${String(error)}`,
    );
  }
}
