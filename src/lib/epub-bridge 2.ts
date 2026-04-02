import Epub, { type Book as EpubBook, type NavItem, type Rendition } from "epubjs";
import { convertFileSrc } from "@tauri-apps/api/core";
import type Contents from "epubjs/types/contents";

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
const COVER_SECTION_HINTS = ["cover", "titlepage", "title-page", "frontcover", "front-cover"];
const TRACKPAD_SWIPE_THRESHOLD = 32;
const MIN_HORIZONTAL_DELTA = 2;

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

function isCoverLikeHref(href: string) {
  const normalizedHref = normalizeHref(href).toLowerCase();
  return COVER_SECTION_HINTS.some((hint) => normalizedHref.includes(hint));
}

function resolveChapterTitle(currentHref: string, toc: ReaderTocItem[], fallbackTitle: string) {
  const normalizedCurrentHref = normalizeHref(currentHref);
  const matchedItem = toc.find((item) => normalizeHref(item.href) === normalizedCurrentHref);

  return matchedItem?.label || fallbackTitle;
}

function getBeginningTarget(tocItems: ReaderTocItem[], epubBook: EpubBook) {
  const firstReadableTocItem = tocItems.find(
    (item) => item.href.trim().length > 0 && !isCoverLikeHref(item.href),
  );

  if (firstReadableTocItem) {
    return firstReadableTocItem.href;
  }

  const spineTargets: string[] = [];
  epubBook.spine.each((section: { href?: string } | null) => {
    if (section?.href) {
      spineTargets.push(section.href);
    }
  });

  const firstReadableSpineTarget = spineTargets.find((href) => !isCoverLikeHref(href));
  if (firstReadableSpineTarget) {
    return firstReadableSpineTarget;
  }

  return epubBook.spine.get(0)?.href ?? null;
}

async function syncCurrentLocation(
  rendition: Rendition,
  handleRelocated: (location: {
    atEnd?: boolean;
    atStart?: boolean;
    start?: { cfi?: string; href?: string; percentage?: number };
  }) => Promise<void>,
) {
  const currentLocation = await rendition.currentLocation();

  if (!currentLocation) {
    return;
  }

  await handleRelocated({
    atEnd: false,
    atStart: false,
    start: {
      cfi: currentLocation.cfi,
      href: currentLocation.href,
      percentage: currentLocation.percentage,
    },
  });
}

function createWheelNavigationHandler(rendition: Rendition) {
  let horizontalWheelDelta = 0;
  let wheelResetTimeout: number | null = null;

  const reset = () => {
    horizontalWheelDelta = 0;

    if (wheelResetTimeout) {
      window.clearTimeout(wheelResetTimeout);
      wheelResetTimeout = null;
    }
  };

  const handleWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaX) < MIN_HORIZONTAL_DELTA) {
      return;
    }

    if (Math.abs(event.deltaX) < Math.abs(event.deltaY) * 0.35) {
      return;
    }

    event.preventDefault();
    horizontalWheelDelta += event.deltaX;

    if (wheelResetTimeout) {
      window.clearTimeout(wheelResetTimeout);
    }

    wheelResetTimeout = window.setTimeout(() => {
      reset();
    }, 180);

    if (Math.abs(horizontalWheelDelta) < TRACKPAD_SWIPE_THRESHOLD) {
      return;
    }

    if (horizontalWheelDelta > 0) {
      void rendition.next();
    } else {
      void rendition.prev();
    }

    reset();
  };

  return {
    cleanup: reset,
    handleWheel,
  };
}

function attachWheelNavigation(
  target: EventTarget | null | undefined,
  handler: (event: WheelEvent) => void,
) {
  if (!target || !("addEventListener" in target) || !("removeEventListener" in target)) {
    return () => undefined;
  }

  target.addEventListener("wheel", handler as EventListener, { passive: false, capture: true });

  return () => {
    target.removeEventListener("wheel", handler as EventListener, true);
  };
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
      "overscroll-behavior": "none",
    },
    body: {
      background: "#ffffff",
      color: "#1a1a1a",
      "font-family": DEFAULT_FONT_FAMILY,
      "font-size": DEFAULT_FONT_SIZE,
      "line-height": DEFAULT_LINE_HEIGHT,
      "overscroll-behavior": "none",
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
  rendition.themes.override("padding-top", "88px");
  rendition.themes.override("padding-bottom", "64px");
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
  const contentCleanupCallbacks = new Set<() => void>();
  let destroyed = false;
  const wheelNavigationHandler = createWheelNavigationHandler(rendition);

  applyReaderTheme(rendition);
  updateReaderMargins(rendition);
  contentCleanupCallbacks.add(attachWheelNavigation(window, wheelNavigationHandler.handleWheel));
  contentCleanupCallbacks.add(attachWheelNavigation(container, wheelNavigationHandler.handleWheel));

  rendition.hooks.content.register((contents: Contents) => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void rendition.prev();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        void rendition.next();
      }
    };

    contents.document.addEventListener("keydown", handleKeyDown);
    const unlistenDocumentWheel = attachWheelNavigation(
      contents.document,
      wheelNavigationHandler.handleWheel,
    );
    const unlistenWindowWheel = attachWheelNavigation(
      contents.window,
      wheelNavigationHandler.handleWheel,
    );
    const unlistenBodyWheel = attachWheelNavigation(
      contents.document.body,
      wheelNavigationHandler.handleWheel,
    );
    const unlistenDocumentElementWheel = attachWheelNavigation(
      contents.document.documentElement,
      wheelNavigationHandler.handleWheel,
    );
    const frameElement = contents.window.frameElement;
    const unlistenFrameWheel = attachWheelNavigation(
      frameElement,
      wheelNavigationHandler.handleWheel,
    );

    if (frameElement instanceof HTMLElement) {
      frameElement.style.overscrollBehavior = "none";
    }

    contentCleanupCallbacks.add(() => {
      contents.document.removeEventListener("keydown", handleKeyDown);
      unlistenDocumentWheel();
      unlistenWindowWheel();
      unlistenBodyWheel();
      unlistenDocumentElementWheel();
      unlistenFrameWheel();
    });
  });

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
  const destroyBridge = () => {
    if (destroyed) {
      return;
    }

    destroyed = true;
    rendition.off("relocated", handleRelocated);
    window.removeEventListener("resize", handleResize);
    wheelNavigationHandler.cleanup();
    contentCleanupCallbacks.forEach((cleanup) => cleanup());
    contentCleanupCallbacks.clear();
    rendition.destroy();
    epubBook.destroy();
  };

  try {
    await epubBook.ready;

    const navigation = await epubBook.loaded.navigation;
    tocItems = flattenTocItems(navigation?.toc ?? []);
    const beginningTarget = getBeginningTarget(tocItems, epubBook);
    const savedCfi = book.last_position_cfi?.trim() || null;
    const renditionManager = (
      rendition as unknown as {
        manager?: { container?: HTMLElement | null; stage?: { container?: HTMLElement | null } };
      }
    ).manager;

    contentCleanupCallbacks.add(
      attachWheelNavigation(renditionManager?.container, wheelNavigationHandler.handleWheel),
    );
    contentCleanupCallbacks.add(
      attachWheelNavigation(
        renditionManager?.stage?.container,
        wheelNavigationHandler.handleWheel,
      ),
    );

    rendition.on("relocated", handleRelocated);
    window.addEventListener("resize", handleResize);

    if (savedCfi) {
      try {
        await rendition.display(savedCfi);
      } catch {
        if (beginningTarget) {
          await rendition.display(beginningTarget);
        } else {
          await rendition.display();
        }
      }
    } else if (beginningTarget) {
      await rendition.display(beginningTarget);
    } else {
      await rendition.display();
    }

    onReady({
      bridge: {
        destroy: destroyBridge,
        goToHref: (href) => rendition.display(href),
        next: () => rendition.next(),
        prev: () => rendition.prev(),
      },
      toc: tocItems,
    });

    await syncCurrentLocation(rendition, handleRelocated);

    void epubBook.locations
      .generate(1024)
      .then(async () => {
        if (!destroyed) {
          await syncCurrentLocation(rendition, handleRelocated);
        }
      })
      .catch(() => undefined);
  } catch (error) {
    destroyBridge();
    onError(toReaderError(error));
    throw error;
  }

  return {
    destroy: destroyBridge,
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
