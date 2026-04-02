import { invoke } from "@tauri-apps/api/core";

import type { Book, ImportBookResult, LibraryFilter } from "@/types/book";

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
    return await invokeTauri<ImportBookResult>("import_book", { file_paths: filePaths });
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
    return await invokeTauri<Book>("get_book", { book_id: bookId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("GET_BOOK_FAILED", `Failed to load book: ${String(error)}`);
  }
}

export async function deleteBook(bookId: string): Promise<void> {
  try {
    await invokeTauri<void>("delete_book", { book_id: bookId });
  } catch (error) {
    if (error instanceof FolioError) {
      throw error;
    }

    throw new FolioError("DELETE_BOOK_FAILED", `Failed to delete book: ${String(error)}`);
  }
}
