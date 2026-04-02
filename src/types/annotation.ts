export type HighlightColor =
  | "#FFD60A"
  | "#30D158"
  | "#0A84FF"
  | "#FF375F"
  | "#BF5AF2";

export interface Highlight {
  id: string;
  book_id: string;
  cfi_range: string;
  color: HighlightColor;
  text_excerpt: string;
  created_at: number;
}

export interface Note {
  id: string;
  book_id: string;
  highlight_id: string | null;
  cfi: string;
  text_excerpt: string;
  body: string;
  created_at: number;
  updated_at: number;
}
