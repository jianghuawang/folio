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

interface WrappedQuote {
  lines: string[];
}

interface QuoteCoverCardPalette {
  accent: string;
  cardBackground: string;
  cardBorder: string;
  divider: string;
  primaryText: string;
  secondaryText: string;
  shadow: string;
  watermark: string;
}

const PREFERRED_BREAK_CHARS = [
  " ",
  "，",
  "。",
  "！",
  "？",
  "；",
  "：",
  "、",
  ",",
  ".",
  "!",
  "?",
  ";",
  ":",
];

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

function getQuoteCoverCardPalette(themeId: QuoteCoverThemeId): QuoteCoverCardPalette {
  switch (themeId) {
    case "midnight":
      return {
        accent: "#8d8d93",
        cardBackground: "rgba(248, 247, 243, 0.96)",
        cardBorder: "rgba(17, 17, 19, 0.08)",
        divider: "rgba(17, 17, 19, 0.14)",
        primaryText: "#161618",
        secondaryText: "rgba(22, 22, 24, 0.62)",
        shadow: "rgba(0, 0, 0, 0.20)",
        watermark: "rgba(22, 22, 24, 0.28)",
      };
    case "ocean":
      return {
        accent: "#7ba9c7",
        cardBackground: "rgba(252, 253, 254, 0.96)",
        cardBorder: "rgba(10, 61, 98, 0.08)",
        divider: "rgba(10, 61, 98, 0.16)",
        primaryText: "#14384c",
        secondaryText: "rgba(20, 56, 76, 0.62)",
        shadow: "rgba(6, 38, 62, 0.16)",
        watermark: "rgba(20, 56, 76, 0.26)",
      };
    case "rose":
      return {
        accent: "#d9a9b8",
        cardBackground: "rgba(255, 251, 252, 0.96)",
        cardBorder: "rgba(61, 0, 20, 0.08)",
        divider: "rgba(61, 0, 20, 0.14)",
        primaryText: "#3d0014",
        secondaryText: "rgba(61, 0, 20, 0.56)",
        shadow: "rgba(61, 0, 20, 0.12)",
        watermark: "rgba(61, 0, 20, 0.24)",
      };
    case "forest":
      return {
        accent: "#9eb79d",
        cardBackground: "rgba(248, 251, 246, 0.96)",
        cardBorder: "rgba(26, 46, 26, 0.08)",
        divider: "rgba(26, 46, 26, 0.14)",
        primaryText: "#203025",
        secondaryText: "rgba(32, 48, 37, 0.58)",
        shadow: "rgba(16, 28, 16, 0.16)",
        watermark: "rgba(32, 48, 37, 0.24)",
      };
    case "warm":
    default:
      return {
        accent: "#c9b59d",
        cardBackground: "rgba(255, 252, 246, 0.97)",
        cardBorder: "rgba(59, 47, 47, 0.08)",
        divider: "rgba(59, 47, 47, 0.14)",
        primaryText: "#332724",
        secondaryText: "rgba(59, 47, 47, 0.55)",
        shadow: "rgba(59, 47, 47, 0.10)",
        watermark: "rgba(59, 47, 47, 0.24)",
      };
  }
}

function findPreferredBreakIndex(text: string) {
  let bestIndex = -1;

  PREFERRED_BREAK_CHARS.forEach((character) => {
    const index = text.lastIndexOf(character);
    if (index > bestIndex) {
      bestIndex = index;
    }
  });

  if (bestIndex > 0 && bestIndex >= text.length * 0.42) {
    return bestIndex + 1;
  }

  return -1;
}

function wrapSingleTextBlock(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const characters = Array.from(text);
  const lines: string[] = [];
  let currentLine = "";

  characters.forEach((character) => {
    const nextLine = currentLine + character;
    if (!currentLine || context.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
      return;
    }

    const breakIndex = findPreferredBreakIndex(currentLine);
    if (breakIndex > 0) {
      lines.push(currentLine.slice(0, breakIndex).trim());
      currentLine = `${currentLine.slice(breakIndex)}${character}`.trimStart();
      return;
    }

    lines.push(currentLine.trim());
    currentLine = character === " " ? "" : character;
  });

  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }

  return lines;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): WrappedQuote {
  const normalizedBlocks = text
    .trim()
    .split(/\n+/)
    .map((block) => block.trim().replace(/\s+/g, " "))
    .filter((block) => block.length > 0);

  if (normalizedBlocks.length === 0) {
    return {
      lines: [""],
    };
  }

  const lines: string[] = [];

  normalizedBlocks.forEach((block, blockIndex) => {
    lines.push(...wrapSingleTextBlock(context, block, maxWidth));
    if (blockIndex < normalizedBlocks.length - 1) {
      lines.push("");
    }
  });

  return {
    lines,
  };
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
  context.roundRect(x, y, width, height, Math.min(width, height) * 0.18);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = `700 ${Math.min(width, height) * 0.42}px Georgia`;
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
  const theme =
    QUOTE_COVER_THEMES.find((candidate) => candidate.id === themeId) ?? QUOTE_COVER_THEMES[0];
  const palette = getQuoteCoverCardPalette(theme.id);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const scale = size / 1080;

  if (!context) {
    throw new Error("Could not initialize canvas.");
  }

  context.fillStyle = theme.background;
  context.fillRect(0, 0, size, size);

  const backdropGradient = context.createLinearGradient(0, 0, 0, size);
  backdropGradient.addColorStop(0, "rgba(255,255,255,0.10)");
  backdropGradient.addColorStop(1, "rgba(0,0,0,0.08)");
  context.fillStyle = backdropGradient;
  context.fillRect(0, 0, size, size);

  const cardWidth = size - 200 * scale;
  const cardHeight = size - 360 * scale;
  const cardX = (size - cardWidth) / 2;
  const cardY = (size - cardHeight) / 2;
  const cardRadius = 44 * scale;

  context.save();
  context.fillStyle = palette.shadow;
  context.shadowColor = palette.shadow;
  context.shadowBlur = 38 * scale;
  context.shadowOffsetY = 18 * scale;
  context.beginPath();
  context.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
  context.fill();
  context.restore();

  context.fillStyle = palette.cardBackground;
  context.beginPath();
  context.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
  context.fill();

  context.strokeStyle = palette.cardBorder;
  context.lineWidth = Math.max(1, 2 * scale);
  context.beginPath();
  context.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
  context.stroke();

  const cardGlow = context.createRadialGradient(
    cardX + cardWidth * 0.25,
    cardY + cardHeight * 0.18,
    0,
    cardX + cardWidth * 0.25,
    cardY + cardHeight * 0.18,
    cardWidth * 0.55,
  );
  cardGlow.addColorStop(0, "rgba(255,255,255,0.85)");
  cardGlow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = cardGlow;
  context.beginPath();
  context.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
  context.fill();

  const bracketX = cardX + 56 * scale;
  const bracketY = cardY + 56 * scale;
  const bracketWidth = 18 * scale;
  const bracketHeight = 20 * scale;
  context.strokeStyle = palette.accent;
  context.lineWidth = Math.max(1, 3 * scale);
  context.beginPath();
  context.moveTo(bracketX, bracketY + bracketHeight);
  context.lineTo(bracketX, bracketY);
  context.lineTo(bracketX + bracketWidth, bracketY);
  context.stroke();

  const dividerY = cardY + cardHeight - 178 * scale;
  context.strokeStyle = palette.divider;
  context.lineWidth = Math.max(1, 2 * scale);
  context.beginPath();
  context.moveTo(cardX + 44 * scale, dividerY);
  context.lineTo(cardX + cardWidth - 44 * scale, dividerY);
  context.stroke();

  const quoteLeft = cardX + 78 * scale;
  const quoteTop = cardY + 82 * scale;
  const quoteWidth = cardWidth - 156 * scale;
  const quoteHeight = dividerY - quoteTop - 52 * scale;
  const quotedText = `“${quoteText.trim()}”`;
  let fontSize = Math.round(66 * scale);
  let wrappedQuote: WrappedQuote = {
    lines: [quotedText],
  };
  let lineHeight = fontSize * 1.18;

  while (fontSize >= Math.round(14 * scale)) {
    context.font = `500 ${fontSize}px Georgia`;
    wrappedQuote = wrapText(context, quotedText, quoteWidth);
    lineHeight = fontSize * (fontSize <= 24 * scale ? 1.14 : 1.18);
    const blockHeight = wrappedQuote.lines.length * lineHeight;
    if (blockHeight <= quoteHeight) {
      break;
    }
    fontSize -= Math.max(1, Math.round(2 * scale));
  }

  context.fillStyle = palette.primaryText;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.font = `500 ${fontSize}px Georgia`;
  const quoteBlockHeight = wrappedQuote.lines.length * lineHeight;
  const quoteBlockTop = quoteTop + Math.max(0, (quoteHeight - quoteBlockHeight) / 2);

  wrappedQuote.lines.forEach((line, index) => {
    context.fillText(line, quoteLeft, quoteBlockTop + index * lineHeight);
  });

  const coverX = quoteLeft;
  const coverWidth = 80 * scale;
  const coverHeight = 110 * scale;
  const coverY = dividerY + 32 * scale;

  context.save();
  context.fillStyle = "rgba(0,0,0,0.10)";
  context.shadowColor = "rgba(0,0,0,0.10)";
  context.shadowBlur = 24 * scale;
  context.shadowOffsetY = 8 * scale;
  context.beginPath();
  context.roundRect(coverX, coverY, coverWidth, coverHeight, 16 * scale);
  context.fill();
  context.restore();

  const cover = await loadBookCover(book);
  if (cover) {
    context.save();
    context.beginPath();
    context.roundRect(coverX, coverY, coverWidth, coverHeight, 16 * scale);
    context.clip();
    context.drawImage(cover, coverX, coverY, coverWidth, coverHeight);
    context.restore();
  } else {
    drawPlaceholderCover(context, book, coverX, coverY, coverWidth, coverHeight);
  }

  const titleX = coverX + coverWidth + 28 * scale;
  const titleY = coverY + 12 * scale;
  const authorY = titleY + 34 * scale;
  const metaWidth = cardX + cardWidth - titleX - 42 * scale;

  context.fillStyle = palette.primaryText;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.font = `600 ${22 * scale}px Georgia`;
  context.fillText(book.title, titleX, titleY, metaWidth);

  context.fillStyle = palette.secondaryText;
  context.font = `italic ${18 * scale}px Georgia`;
  context.fillText(book.author, titleX, authorY, metaWidth);

  context.fillStyle = palette.watermark;
  context.textAlign = "right";
  context.textBaseline = "alphabetic";
  context.font = `500 ${10 * scale}px Georgia`;
  context.fillText(
    "Made with Folio",
    cardX + cardWidth - 42 * scale,
    cardY + cardHeight - 28 * scale,
  );

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
