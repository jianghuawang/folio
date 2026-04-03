import { convertFileSrc } from "@tauri-apps/api/core";

import { hashStringToColor } from "@/lib/utils";
import type { Book } from "@/types/book";

export type QuoteCoverThemeId = "forest" | "midnight" | "ocean" | "rose" | "warm";

export interface QuoteCoverTheme {
  background: string;
  id: QuoteCoverThemeId;
  label: string;
  text: string;
}

export const QUOTE_COVER_THEMES: QuoteCoverTheme[] = [
  { background: "#f5f0e8", id: "warm", label: "Warm", text: "#3b2f2f" },
  { background: "#1c1c1e", id: "midnight", label: "Midnight", text: "#e5e5ea" },
  { background: "#0a3d62", id: "ocean", label: "Ocean", text: "#e8f4f8" },
  { background: "#fff0f3", id: "rose", label: "Rose", text: "#3d0014" },
  { background: "#1a2e1a", id: "forest", label: "Forest", text: "#d4edda" },
];

interface RenderQuoteCoverOptions {
  book: Book;
  quoteText: string;
  size?: number;
  themeId: QuoteCoverThemeId;
}

async function loadBookCover(book: Book): Promise<HTMLImageElement | null> {
  if (!book.cover_image_path) {
    return null;
  }

  const assetUrl = convertFileSrc(book.cover_image_path);
  const response = await fetch(assetUrl);
  if (!response.ok) {
    return null;
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    const measuredWidth = context.measureText(nextLine).width;

    if (measuredWidth <= maxWidth || !currentLine) {
      currentLine = nextLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const truncated = lines.slice(0, maxLines);
  truncated[maxLines - 1] = `${truncated[maxLines - 1].replace(/\s+\S+$/, "")}…`;
  return truncated;
}

function drawPlaceholderCover(
  context: CanvasRenderingContext2D,
  book: Book,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = hashStringToColor(book.title);
  context.beginPath();
  context.roundRect(x, y, width, height, 18);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "700 48px Georgia";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(book.title.trim().charAt(0).toUpperCase() || "?", x + width / 2, y + height / 2);
}

export async function renderQuoteCoverBlob({
  book,
  quoteText,
  size = 1080,
  themeId,
}: RenderQuoteCoverOptions): Promise<Blob> {
  const theme = QUOTE_COVER_THEMES.find((candidate) => candidate.id === themeId) ?? QUOTE_COVER_THEMES[0];
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not initialize canvas.");
  }

  context.fillStyle = theme.background;
  context.fillRect(0, 0, size, size);

  const quoteWidth = size * 0.8;
  const quotedText = `“${quoteText.trim()}”`;
  let fontSize = 74;
  let wrappedLines: string[] = [];

  while (fontSize >= 40) {
    context.font = `${fontSize}px Georgia`;
    wrappedLines = wrapText(context, quotedText, quoteWidth, 3);
    if (wrappedLines.length <= 3) {
      break;
    }
    fontSize -= 4;
  }

  context.fillStyle = theme.text;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${fontSize}px Georgia`;

  const lineHeight = fontSize * 1.24;
  const blockHeight = wrappedLines.length * lineHeight;
  const startY = size * 0.38 - blockHeight / 2 + lineHeight / 2;

  wrappedLines.forEach((line, index) => {
    context.fillText(line, size / 2, startY + index * lineHeight);
  });

  context.fillStyle = `${theme.text}99`;
  context.font = "600 28px Georgia";
  context.fillText(book.title, size / 2, startY + blockHeight + 72);

  context.fillStyle = `${theme.text}80`;
  context.font = "italic 24px Georgia";
  context.fillText(book.author, size / 2, startY + blockHeight + 116);

  const coverX = 72;
  const coverY = size - 182;
  const coverWidth = 110;
  const coverHeight = 150;

  const cover = await loadBookCover(book);
  if (cover) {
    context.save();
    context.beginPath();
    context.roundRect(coverX, coverY, coverWidth, coverHeight, 18);
    context.clip();
    context.drawImage(cover, coverX, coverY, coverWidth, coverHeight);
    context.restore();
  } else {
    drawPlaceholderCover(context, book, coverX, coverY, coverWidth, coverHeight);
  }

  context.fillStyle = `${theme.text}4d`;
  context.textAlign = "right";
  context.font = "500 20px Georgia";
  context.fillText("Made with Folio", size - 72, size - 64);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not generate image. Please try again."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

