import Epub, { type Book as EpubBook, type NavItem, type Rendition } from "epubjs";
import { convertFileSrc } from "@tauri-apps/api/core";

import type { Book } from "@/types/book";

export interface ReaderTocItem {
  depth: number;
  href: string;
  id: string;
  label: string;
}

export interface ReaderLocationState {
  atEnd: boolean;
  atStart: boolean;
  cfi: string;
  chapterTitle: string;
  href: string;
  progress: number;
}

export interface EpubBridge {
  destroy: () => void;
  goToHref: (href: string) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
}

interface CreateEpubBridgeOptions {
  book: Book;
  container: HTMLElement;
  onError: (error: Error) => void;
  onLocationChange: (location: ReaderLocationState) => void;
  onReady: (payload: { bridge: EpubBridge; toc: ReaderTocItem[] }) => void;
}

const DEFAULT_FONT_SIZE = "18px";
const DEFAULT_FONT_FAMILY = "Georgia, serif";
const DEFAULT_LINE_HEIGHT = "1.6";

function flattenTocItems(items: NavItem[], depth = 0): ReaderTocItem[] {
  return items.flatMap((item) => {
    const currentItem: ReaderTocItem = {
      depth,
      href: item.href,
      id: item.id,
      label: item.label,
    };

    return [currentItem, ...flattenTocItems(item.subitems ?? [], depth + 1)];
  });
}

function normalizeHref(href: string) {
  return href.split("#")[0] ?? href;
}

function resolveChapterTitle(currentHref: string, toc: ReaderTocItem[], fallbackTitle: string) {
  const normalizedCurrentHref = normalizeHref(currentHref);
  const matchedItem = toc.find((item) => normalizeHref(item.href) === normalizedCurrentHref);

  return matchedItem?.label || fallbackTitle;
}

function applyReaderTheme(rendition: Rendition) {
  rendition.themes.register("folio-light", {
    "html, body": {
      background: "#ffffff",
      color: "#1a1a1a",
      "font-family": DEFAULT_FONT_FAMILY,
      "font-size": DEFAULT_FONT_SIZE,
      "line-height": DEFAULT_LINE_HEIGHT,
      margin: "0",
      padding: "0",
    },
    body: {
      background: "#ffffff",
      color: "#1a1a1a",
      "font-family": DEFAULT_FONT_FAMILY,
      "font-size": DEFAULT_FONT_SIZE,
      "line-height": DEFAULT_LINE_HEIGHT,
    },
    p: {
      "line-height": DEFAULT_LINE_HEIGHT,
    },
  });
  rendition.themes.select("folio-light");
  rendition.themes.font(DEFAULT_FONT_FAMILY);
  rendition.themes.fontSize(DEFAULT_FONT_SIZE);
  rendition.themes.override("line-height", DEFAULT_LINE_HEIGHT);
}

function updateReaderMargins(rendition: Rendition) {
  const horizontalPadding = window.innerWidth >= 800 ? "80px" : "40px";
  rendition.themes.override("padding-left", horizontalPadding);
  rendition.themes.override("padding-right", horizontalPadding);
  rendition.themes.override("padding-top", "48px");
  rendition.themes.override("padding-bottom", "48px");
}

function toReaderError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

export async function createEpubBridge({
  book,
  container,
  onError,
  onLocationChange,
  onReady,
}: CreateEpubBridgeOptions): Promise<EpubBridge> {
  const assetUrl = convertFileSrc(book.file_path);
  const epubBook = Epub(assetUrl) as EpubBook;
  const rendition = epubBook.renderTo(container, {
    flow: "paginated",
    height: "100%",
    width: "100%",
  });

  applyReaderTheme(rendition);
  updateReaderMargins(rendition);

  const handleResize = () => {
    updateReaderMargins(rendition);
  };

  const handleRelocated = async (location: {
    atEnd?: boolean;
    atStart?: boolean;
    start?: { cfi?: string; href?: string; percentage?: number };
  }) => {
    const currentCfi = location.start?.cfi ?? "";
    const currentHref = location.start?.href ?? "";
    const percentage =
      currentCfi && epubBook.locations
        ? epubBook.locations.percentageFromCfi(currentCfi)
        : location.start?.percentage ?? 0;

    onLocationChange({
      atEnd: Boolean(location.atEnd),
      atStart: Boolean(location.atStart),
      cfi: currentCfi,
      chapterTitle: resolveChapterTitle(currentHref, tocItems, book.title),
      href: currentHref,
      progress: Number.isFinite(percentage) ? percentage : 0,
    });
  };

  let tocItems: ReaderTocItem[] = [];

  try {
    await epubBook.ready;
    await epubBook.locations.generate(1024);

    const navigation = await epubBook.loaded.navigation;
    tocItems = flattenTocItems(navigation?.toc ?? []);

    rendition.on("relocated", handleRelocated);
    window.addEventListener("resize", handleResize);

    await rendition.display();

    onReady({
      bridge: {
        destroy: () => {
          rendition.off("relocated", handleRelocated);
          window.removeEventListener("resize", handleResize);
          rendition.destroy();
          epubBook.destroy();
        },
        goToHref: (href) => rendition.display(href),
        next: () => rendition.next(),
        prev: () => rendition.prev(),
      },
      toc: tocItems,
    });

    const initialLocation = await rendition.currentLocation();
    if (initialLocation) {
      await handleRelocated({
        atEnd: false,
        atStart: true,
        start: {
          cfi: initialLocation.cfi,
          href: initialLocation.href,
          percentage: initialLocation.percentage,
        },
      });
    }
  } catch (error) {
    rendition.destroy();
    epubBook.destroy();
    onError(toReaderError(error));
    throw error;
  }

  return {
    destroy: () => {
      rendition.off("relocated", handleRelocated);
      window.removeEventListener("resize", handleResize);
      rendition.destroy();
      epubBook.destroy();
    },
    goToHref: (href) => rendition.display(href),
    next: () => rendition.next(),
    prev: () => rendition.prev(),
  };
}

export function getReaderErrorMessage(error: Error) {
  const message = error.message.toLowerCase();

  if (message.includes("drm") || message.includes("encrypted")) {
    return "This book is DRM-protected and cannot be opened in Folio.";
  }

  return "This book could not be opened in Folio.";
}

export function normalizeTocHref(href: string) {
  return normalizeHref(href);
}
