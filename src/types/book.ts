export type LibraryFilter = "all" | "recent";

export interface Book {
  id: string;
  title: string;
  author: string;
  file_path: string;
  cover_image_path: string | null;
  added_at: number;
  last_read_at: number | null;
  last_position_cfi: string | null;
  file_hash: string;
  reading_progress: number;
}

export type BookSummary = Book;

export interface ImportDuplicate {
  title: string;
}

export interface ImportError {
  filename: string;
}

export interface ImportBookResult {
  books: Book[];
  duplicates: ImportDuplicate[];
  errors: ImportError[];
}
