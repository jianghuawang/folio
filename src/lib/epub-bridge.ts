import Epub, { type Book as EpubBook, type NavItem, type Rendition } from "epubjs";
import { convertFileSrc } from "@tauri-apps/api/core";
import type Contents from "epubjs/types/contents";

import type { Highlight, Note } from "@/types/annotation";
import type { Book } from "@/types/book";
import type { ReadingFontFamily, ReadingSettings, ReadingTheme } from "@/types/settings";
import type { Translation } from "@/types/translation";

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

export interface ReaderSelectionPayload {
  cfiRange: string;
  position: {
    left: number;
    top: number;
  };
  text: string;
}

export interface ReaderHighlightActivationPayload {
  cfiRange: string;
  highlightId: string;
  position: {
    left: number;
    top: number;
  };
  text: string;
}

export interface ReaderNoteActivationPayload {
  note: Note;
  position: {
    left: number;
    top: number;
  };
}

export interface ReaderAnnotationLocation {
  chapterTitle: string;
  progress: number;
}

interface ReaderSelectionSnapshot {
  range: Range;
  rect: DOMRect;
  text: string;
  timestamp: number;
}

export interface EpubBridge {
  applyReadingSettings: (settings: ReadingSettings) => void;
  clearSelection: () => void;
  destroy: () => void;
  goToCfi: (cfi: string) => Promise<void>;
  goToHref: (href: string) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  resolveAnnotationLocation: (cfi: string) => Promise<ReaderAnnotationLocation | null>;
  setHighlights: (highlights: Highlight[]) => void;
  setNotes: (notes: Note[]) => void;
  setTranslations: (payload: {
    enabled: boolean;
    targetLanguage: string | null;
    translations: Translation[];
  }) => void;
}

interface CreateEpubBridgeOptions {
  book: Book;
  container: HTMLElement;
  onError: (error: Error) => void;
  onHighlightActivate?: (payload: ReaderHighlightActivationPayload) => void;
  onLocationChange: (location: ReaderLocationState) => void;
  onNoteActivate?: (payload: ReaderNoteActivationPayload) => void;
  onPositionRestoreError?: () => void;
  onReady: (payload: { bridge: EpubBridge; toc: ReaderTocItem[] }) => void;
  onSelectionChange?: (selection: ReaderSelectionPayload | null) => void;
  readingSettings: ReadingSettings;
}

type RenditionLocation = {
  atEnd?: boolean;
  atStart?: boolean;
  cfi?: string;
  href?: string;
  percentage?: number;
  start?: { cfi?: string; href?: string; percentage?: number };
};

const COVER_SECTION_HINTS = ["cover", "titlepage", "title-page", "frontcover", "front-cover"];
const TRACKPAD_SWIPE_THRESHOLD = 90;
const MIN_HORIZONTAL_DELTA = 8;
const INITIAL_DISPLAY_TIMEOUT_MS = 4000;
const BOOK_READY_TIMEOUT_MS = 4000;
const SELECTION_SNAPSHOT_TTL_MS = 500;
const NOTE_MARKER_SIZE_PX = 7;
const NOTE_MARKER_LAYER_ATTRIBUTE = "data-folio-note-marker-layer";
const NOTE_MARKER_ATTRIBUTE = "data-folio-note-marker";
const NOTE_MARKER_DEFAULT_COLOR = "#FFD60A";

const FONT_STACKS: Record<ReadingFontFamily, string> = {
  Georgia: "Georgia, serif",
  Menlo: "Menlo, Monaco, monospace",
  Palatino: "\"Palatino Linotype\", \"Book Antiqua\", Palatino, serif",
  "system-ui": "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", sans-serif",
};

const THEME_STYLES: Record<
  ReadingTheme,
  {
    background: string;
    color: string;
    translationColor: string;
  }
> = {
  dark: {
    background: "#2c2c2e",
    color: "#e5e5ea",
    translationColor: "#8e8e93",
  },
  light: {
    background: "#ffffff",
    color: "#1a1a1a",
    translationColor: "#6e6e73",
  },
  sepia: {
    background: "#f5f0e8",
    color: "#3b2f2f",
    translationColor: "#6e6e73",
  },
};

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  font_family: "Georgia",
  font_size: 18,
  line_height: 1.6,
  theme: "light",
};

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
  return href.split("#")[0]?.split("?")[0] ?? href;
}

function getTranslationKey(spineItemHref: string, paragraphIndex: number) {
  return `${normalizeHref(spineItemHref)}::${paragraphIndex}`;
}

function normalizeHrefCandidate(href: string) {
  const trimmedHref = href.trim();
  if (!trimmedHref) {
    return "";
  }

  try {
    return normalizeHref(decodeURIComponent(new URL(trimmedHref).pathname)).replace(/^\/+/, "");
  } catch {
    try {
      return normalizeHref(decodeURIComponent(trimmedHref)).replace(/^\/+/, "");
    } catch {
      return normalizeHref(trimmedHref).replace(/^\/+/, "");
    }
  }
}

function resolveKnownSpineHref(candidateHref: string, spineHrefs: readonly string[]) {
  const normalizedCandidate = normalizeHrefCandidate(candidateHref);
  if (!normalizedCandidate) {
    return null;
  }

  for (const spineHref of spineHrefs) {
    if (
      normalizedCandidate === spineHref ||
      normalizedCandidate.endsWith(`/${spineHref}`) ||
      normalizedCandidate.endsWith(`/OEBPS/${spineHref}`)
    ) {
      return spineHref;
    }
  }

  return null;
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
  handleRelocated: (location: RenditionLocation) => Promise<void>,
) {
  const currentLocation = await rendition.currentLocation();

  if (!currentLocation) {
    return;
  }

  await handleRelocated({
    atEnd: false,
    atStart: false,
    cfi: currentLocation.cfi,
    href: currentLocation.href,
    percentage: currentLocation.percentage,
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
  let swipeLocked = false;
  const handledWheelEvents = new WeakSet<WheelEvent>();

  const reset = () => {
    horizontalWheelDelta = 0;
    swipeLocked = false;

    if (wheelResetTimeout) {
      window.clearTimeout(wheelResetTimeout);
      wheelResetTimeout = null;
    }
  };

  const handleWheel = (event: WheelEvent) => {
    if (handledWheelEvents.has(event)) {
      return;
    }

    handledWheelEvents.add(event);

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
    }, 260);

    if (swipeLocked) {
      return;
    }

    if (Math.abs(horizontalWheelDelta) < TRACKPAD_SWIPE_THRESHOLD) {
      return;
    }

    swipeLocked = true;

    if (horizontalWheelDelta > 0) {
      void rendition.next();
    } else {
      void rendition.prev();
    }

    horizontalWheelDelta = 0;
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

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(
    target.closest("input, textarea, select, button, a, [contenteditable='true']"),
  );
}

function registerReaderThemes(rendition: Rendition) {
  (Object.keys(THEME_STYLES) as ReadingTheme[]).forEach((themeKey) => {
    const styles = THEME_STYLES[themeKey];

    rendition.themes.register(`folio-${themeKey}`, {
      ".folio-translation": {
        color: styles.translationColor,
        "font-size": "16px",
        "line-height": "1.7",
        margin: "4px 0 0 0",
      },
      "html, body": {
        background: styles.background,
        color: styles.color,
        margin: "0",
        "overscroll-behavior": "none",
        padding: "0",
      },
      body: {
        background: styles.background,
        color: styles.color,
        margin: "0",
        "overscroll-behavior": "none",
        padding: "0",
      },
      img: {
        "max-width": "100% !important",
      },
      "a img, sup img, sub img, span img, em img, strong img, small img, .duokan-footnote img, .footnote img, .noteref img, .endnote img": {
        "max-height": "1.5em !important",
        "max-width": "1.5em !important",
        "vertical-align": "middle !important",
        "height": "auto !important",
      },
      p: {
        margin: "0 0 1em 0",
      },
    });
  });
}

function syncThemeStylesToVisibleContents(rendition: Rendition, theme: ReadingTheme) {
  const styles = THEME_STYLES[theme];
  const getContents = (
    rendition as Rendition & {
      getContents?: () => Array<{
        document: Document;
        window?: Window;
      }>;
    }
  ).getContents;

  if (typeof getContents !== "function") {
    return;
  }

  getContents.call(rendition).forEach((contents) => {
    const documentElement = contents.document.documentElement;
    const body = contents.document.body;
    const frameElement = contents.window?.frameElement as HTMLElement | null | undefined;

    documentElement?.style.setProperty("background", styles.background);
    documentElement?.style.setProperty("color", styles.color);

    body?.style.setProperty("background", styles.background);
    body?.style.setProperty("color", styles.color);

    contents.document
      .querySelectorAll<HTMLElement>(".folio-translation")
      .forEach((translationElement) => {
        translationElement.style.setProperty("color", styles.translationColor);
      });

    frameElement?.style.setProperty("background", styles.background);
  });
}

function applyReadingSettingsToRendition(rendition: Rendition, settings: ReadingSettings) {
  rendition.themes.select(`folio-${settings.theme}`);
  rendition.themes.font(FONT_STACKS[settings.font_family]);
  rendition.themes.fontSize(`${settings.font_size}px`);
  rendition.themes.override("font-family", FONT_STACKS[settings.font_family]);
  rendition.themes.override("font-size", `${settings.font_size}px`);
  rendition.themes.override("line-height", settings.line_height.toString());
  syncThemeStylesToVisibleContents(rendition, settings.theme);
}

function updateReaderMargins(rendition: Rendition) {
  const horizontalPadding = window.innerWidth >= 800 ? "80px" : "40px";
  const topPadding = window.innerWidth >= 800 ? "124px" : "112px";
  const bottomPadding = window.innerWidth >= 800 ? "68px" : "56px";
  rendition.themes.override("padding-left", horizontalPadding);
  rendition.themes.override("padding-right", horizontalPadding);
  rendition.themes.override("padding-top", topPadding);
  rendition.themes.override("padding-bottom", bottomPadding);
}

function toReaderError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

async function displayWithTimeout(
  rendition: Rendition,
  target?: string | null,
  timeoutMs = INITIAL_DISPLAY_TIMEOUT_MS,
) {
  let timeoutId: number | null = null;

  try {
    await Promise.race([
      target ? rendition.display(target) : rendition.display(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error("DISPLAY_TIMEOUT"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function awaitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  let timeoutId: number | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

function getContentsSectionHref(
  contents: Contents,
  spineHrefByIndex: ReadonlyMap<number, string>,
  knownSpineHrefs: readonly string[],
) {
  const sectionIndex = (contents as unknown as { sectionIndex?: number }).sectionIndex;
  if (typeof sectionIndex === "number") {
    const indexedHref = spineHrefByIndex.get(sectionIndex);
    if (indexedHref) {
      return indexedHref;
    }
  }

  const canonicalHref =
    contents.document.querySelector("link[rel='canonical']")?.getAttribute("href") ??
    contents.document.location?.href ??
    "";

  return resolveKnownSpineHref(canonicalHref, knownSpineHrefs) ?? "";
}

function clearInjectedTranslations(contents: Contents) {
  contents.document
    .querySelectorAll<HTMLElement>("[data-folio-translation='true']")
    .forEach((node) => node.remove());
}

function clampSelectionCoordinate(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function getRangeRect(range: Range) {
  return range.getClientRects()[0] ?? range.getBoundingClientRect();
}

function createSelectionSnapshot(selection: Selection): ReaderSelectionSnapshot | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) {
    return null;
  }

  const range = selection.getRangeAt(0).cloneRange();
  const rect = getRangeRect(range);
  if (!rect) {
    return null;
  }

  return {
    range,
    rect,
    text,
    timestamp: Date.now(),
  };
}

function stopEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

function getEventTargetRect(event: Event) {
  const target =
    event.currentTarget instanceof Element
      ? event.currentTarget
      : event.target instanceof Element
        ? event.target
        : null;

  return {
    frameRect:
      target?.ownerDocument?.defaultView?.frameElement instanceof HTMLElement
        ? target.ownerDocument.defaultView.frameElement.getBoundingClientRect()
        : null,
    targetRect: target?.getBoundingClientRect() ?? null,
  };
}

function resolvePopupPositionFromEvent(event: Event) {
  const { frameRect, targetRect } = getEventTargetRect(event);
  const localLeft = targetRect ? targetRect.left + targetRect.width / 2 : 0;
  const localTop = targetRect ? targetRect.top : 0;

  return {
    left: clampSelectionCoordinate(
      (frameRect?.left ?? 0) + localLeft,
      24,
      window.innerWidth - 24,
    ),
    top: clampSelectionCoordinate(
      (frameRect?.top ?? 0) + localTop,
      24,
      window.innerHeight - 24,
    ),
  };
}

function isFreshSelectionSnapshot(snapshot: ReaderSelectionSnapshot | null) {
  if (!snapshot) {
    return false;
  }

  return Date.now() - snapshot.timestamp <= SELECTION_SNAPSHOT_TTL_MS;
}

function getNoteMarkerRect(range: Range) {
  const rects = Array.from(range.getClientRects());
  return rects[rects.length - 1] ?? range.getBoundingClientRect();
}

function clearInjectedNoteMarkers(contents: Contents) {
  contents.document
    .querySelectorAll<HTMLElement>(`[${NOTE_MARKER_LAYER_ATTRIBUTE}]`)
    .forEach((node) => node.remove());
}

export async function createEpubBridge({
  book,
  container,
  onError,
  onHighlightActivate,
  onLocationChange,
  onNoteActivate,
  onPositionRestoreError,
  onReady,
  onSelectionChange,
  readingSettings,
}: CreateEpubBridgeOptions): Promise<EpubBridge> {
  const assetUrl = convertFileSrc(book.file_path);
  const epubBook = Epub(assetUrl) as EpubBook;
  const rendition = epubBook.renderTo(container, {
    allowScriptedContent: true,
    flow: "paginated",
    height: "100%",
    width: "100%",
  });
  const contentCleanupCallbacks = new Set<() => void>();
  const wheelNavigationHandler = createWheelNavigationHandler(rendition);
  let destroyed = false;
  let tocItems: ReaderTocItem[] = [];
  let lastSelectionWindow: Window | null = null;
  let lastAppliedHighlightSignature = "";
  let lastAppliedNoteSignature = "";
  let lastAppliedSettingsSignature = "";
  let lastAppliedTranslationSignature = "";
  let currentHighlights: Highlight[] = [];
  let currentNotes: Note[] = [];
  let currentReadingSettings = readingSettings;
  let renderedHighlights: Highlight[] = [];
  let currentTranslations = new Map<string, Translation>();
  let bilingualModeEnabled = false;
  let initialDisplayComplete = false;
  let suppressSelectionClearUntil = 0;
  const spineHrefByIndex = new Map<number, string>();

  registerReaderThemes(rendition);
  applyReadingSettingsToRendition(rendition, readingSettings);
  updateReaderMargins(rendition);

  const resolveProgress = (cfi: string, fallbackProgress?: number | null) => {
    let percentage: number | null = null;

    try {
      if (cfi && epubBook.locations.length() > 0) {
        percentage = epubBook.locations.percentageFromCfi(cfi);
      }
    } catch {
      percentage = null;
    }

    if (!Number.isFinite(percentage ?? NaN) && Number.isFinite(fallbackProgress ?? NaN)) {
      percentage = fallbackProgress ?? null;
    }

    if (
      !Number.isFinite(percentage ?? NaN) &&
      cfi &&
      book.last_position_cfi?.trim() === cfi &&
      Number.isFinite(book.reading_progress)
    ) {
      percentage = book.reading_progress;
    }

    if (!Number.isFinite(percentage ?? NaN)) {
      return 0;
    }

    return Math.min(Math.max(percentage ?? 0, 0), 1);
  };

  const invalidateRenderedAnnotations = () => {
    renderedHighlights.forEach((highlight) => {
      try {
        rendition.annotations.remove(highlight.cfi_range, "highlight");
      } catch {
        // ignore annotation cleanup failures
      }
    });

    renderedHighlights = [];
    lastAppliedHighlightSignature = "";
    lastAppliedNoteSignature = "";
  };

  const applyHighlights = () => {
    const nextSignature = currentHighlights
      .map((highlight) => `${highlight.id}:${highlight.cfi_range}:${highlight.color}`)
      .join("|");

    if (nextSignature === lastAppliedHighlightSignature) {
      return;
    }

    renderedHighlights.forEach((highlight) => {
      try {
        rendition.annotations.remove(highlight.cfi_range, "highlight");
      } catch {
        // ignore annotation cleanup failures
      }
    });

    currentHighlights.forEach((highlight) => {
      try {
        rendition.annotations.add(
          "highlight",
          highlight.cfi_range,
          {
            highlightId: highlight.id,
          },
          ((event: Event) => {
            stopEvent(event);
            suppressSelectionClearUntil = Date.now() + 150;
            onHighlightActivate?.({
              cfiRange: highlight.cfi_range,
              highlightId: highlight.id,
              position: resolvePopupPositionFromEvent(event),
              text: highlight.text_excerpt,
            });
          }) as never,
          "hl",
          {
            fill: highlight.color,
            "fill-opacity": "0.35",
          } as never,
        );
      } catch {
        // ignore highlight render failures
      }
    });

    renderedHighlights = currentHighlights;
    lastAppliedHighlightSignature = nextSignature;
  };

  const applyNotes = () => {
    const nextSignature = [
      currentReadingSettings.theme,
      currentHighlights.map((highlight) => `${highlight.id}:${highlight.color}`).join("|"),
      currentNotes.map((note) => `${note.id}:${note.cfi}:${note.highlight_id ?? ""}`).join("|"),
    ].join("::");

    if (nextSignature === lastAppliedNoteSignature) {
      return;
    }

    const highlightById = new Map<string, Highlight>(
      currentHighlights.map((highlight): [string, Highlight] => [highlight.id, highlight]),
    );

    const contentsList =
      (
        rendition as unknown as {
          getContents?: () => Contents[];
        }
      ).getContents?.() ?? [];

    contentsList.forEach((contents) => {
      clearInjectedNoteMarkers(contents);

      if (currentNotes.length === 0) {
        return;
      }

      const markerHost = contents.document.createElement("div");
      markerHost.setAttribute(NOTE_MARKER_LAYER_ATTRIBUTE, "true");
      markerHost.style.setProperty("all", "initial");
      markerHost.style.position = "fixed";
      markerHost.style.inset = "0";
      markerHost.style.pointerEvents = "none";
      markerHost.style.zIndex = "2147483647";

      const markerShadowRoot = markerHost.attachShadow({ mode: "open" });
      const markerLayer = contents.document.createElement("div");
      markerLayer.style.setProperty("all", "initial");
      markerLayer.style.position = "fixed";
      markerLayer.style.inset = "0";
      markerLayer.style.pointerEvents = "none";
      markerLayer.style.display = "block";
      markerLayer.style.zIndex = "2147483647";
      markerShadowRoot.appendChild(markerLayer);

      currentNotes.forEach((note) => {
        try {
          const range = contents.range(note.cfi);
          if (!range) {
            return;
          }

          const rect = getNoteMarkerRect(range);
          if (!rect || rect.width <= 0 || rect.height <= 0) {
            return;
          }

          const marker = contents.document.createElement("div");
          marker.setAttribute(NOTE_MARKER_ATTRIBUTE, note.id);
          marker.style.setProperty("all", "initial");
          marker.style.position = "absolute";
          marker.style.left = `${Math.max(0, rect.right - NOTE_MARKER_SIZE_PX * 0.35)}px`;
          marker.style.top = `${Math.max(0, rect.bottom - NOTE_MARKER_SIZE_PX * 0.85)}px`;
          marker.style.display = "block";
          marker.style.width = `${NOTE_MARKER_SIZE_PX}px`;
          marker.style.height = `${NOTE_MARKER_SIZE_PX}px`;
          marker.style.minWidth = "0";
          marker.style.minHeight = "0";
          marker.style.padding = "0";
          marker.style.margin = "0";
          marker.style.boxSizing = "border-box";
          marker.style.borderRadius = "999px";
          marker.style.border = `1px solid ${THEME_STYLES[currentReadingSettings.theme].background}`;
          marker.style.background = highlightById.get(note.highlight_id ?? "")?.color ?? NOTE_MARKER_DEFAULT_COLOR;
          marker.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.14)";
          marker.style.cursor = "pointer";
          marker.style.pointerEvents = "auto";
          marker.style.overflow = "hidden";
          marker.style.userSelect = "none";
          marker.style.setProperty("-webkit-appearance", "none");
          marker.style.setProperty("appearance", "none");

          const handleNotePointerEvent = (event: Event) => {
            stopEvent(event);
            suppressSelectionClearUntil = Date.now() + 150;
          };

          const handleNoteClick = (event: Event) => {
            handleNotePointerEvent(event);
            onNoteActivate?.({
              note,
              position: resolvePopupPositionFromEvent(event),
            });
          };

          marker.addEventListener("mousedown", handleNotePointerEvent);
          marker.addEventListener("touchstart", handleNotePointerEvent);
          marker.addEventListener("click", handleNoteClick);
          markerLayer.appendChild(marker);
        } catch {
          // ignore note marker render failures
        }
      });

      if (markerLayer.childElementCount > 0) {
        contents.document.body.appendChild(markerHost);
      }
    });

    lastAppliedNoteSignature = nextSignature;
  };

  const injectTranslationsIntoContents = (contents: Contents) => {
    clearInjectedTranslations(contents);

    if (!bilingualModeEnabled || currentTranslations.size === 0) {
      return;
    }

    const sectionHref = getContentsSectionHref(
      contents,
      spineHrefByIndex,
      Array.from(spineHrefByIndex.values()),
    );
    if (!sectionHref) {
      return;
    }

    const paragraphs = Array.from(contents.document.body.querySelectorAll("p"));

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const translation = currentTranslations.get(getTranslationKey(sectionHref, paragraphIndex));
      if (!translation) {
        return;
      }

      const translationElement = contents.document.createElement("p");
      translationElement.className = "folio-translation";
      translationElement.dataset.folioTranslation = "true";
      translationElement.innerHTML = translation.translated_html;
      paragraph.insertAdjacentElement("afterend", translationElement);
    });
  };

  const applyTranslations = () => {
    const contentsList =
      (
        rendition as unknown as {
          getContents?: () => Contents[];
        }
      ).getContents?.() ?? [];

    contentsList.forEach((contents) => {
      injectTranslationsIntoContents(contents);
    });
  };

  const clearSelection = () => {
    lastSelectionWindow?.getSelection()?.removeAllRanges();
    onSelectionChange?.(null);
  };

  const resolveAnnotationLocation = async (cfi: string): Promise<ReaderAnnotationLocation | null> => {
    if (!cfi.trim().length) {
      return null;
    }

    let href = "";

    try {
      const spineSection = (
        epubBook.spine as unknown as { get: (target: string) => { href?: string } | null }
      ).get(cfi);
      href = spineSection?.href ?? "";
    } catch {
      href = "";
    }

    return {
      chapterTitle: resolveChapterTitle(href, tocItems, book.title),
      progress: resolveProgress(cfi),
    };
  };

  const handleResize = () => {
    updateReaderMargins(rendition);
    invalidateRenderedAnnotations();
    void refreshCurrentView().catch(() => undefined);
  };

  const handleReaderKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      void rendition.prev();
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      void rendition.next();
      return;
    }

    if (event.key === "Escape") {
      onSelectionChange?.(null);
    }
  };

  const handleRelocated = async (location: RenditionLocation) => {
    const currentCfi = location.start?.cfi ?? location.cfi ?? "";
    const currentHref = location.start?.href ?? location.href ?? "";
    const percentage = resolveProgress(
      currentCfi,
      location.start?.percentage ?? location.percentage ?? null,
    );

    onLocationChange({
      atEnd: Boolean(location.atEnd),
      atStart: Boolean(location.atStart),
      cfi: currentCfi,
      chapterTitle: resolveChapterTitle(currentHref, tocItems, book.title),
      href: currentHref,
      progress: percentage,
    });

    onSelectionChange?.(null);
    applyTranslations();
    applyHighlights();
    applyNotes();
  };

  const emitSelection = (
    cfiRange: string,
    contents: Contents,
    selectionSnapshot: ReaderSelectionSnapshot,
  ) => {
    const frameElement = contents.window.frameElement as HTMLElement | null;
    const frameRect = frameElement?.getBoundingClientRect() ?? container.getBoundingClientRect();
    const left = clampSelectionCoordinate(
      frameRect.left + selectionSnapshot.rect.left + selectionSnapshot.rect.width / 2,
      24,
      window.innerWidth - 24,
    );
    const top = clampSelectionCoordinate(
      frameRect.top + selectionSnapshot.rect.top,
      24,
      window.innerHeight - 24,
    );

    lastSelectionWindow = contents.window;
    onSelectionChange?.({
      cfiRange,
      position: {
        left,
        top,
      },
      text: selectionSnapshot.text,
    });
  };

  rendition.hooks.content.register((contents: Contents) => {
    let lastSelectionSnapshot: ReaderSelectionSnapshot | null = null;
    let lastSelectedCfiRange: { timestamp: number; value: string } | null = null;
    let selectionSyncTimeout: number | null = null;
    let selectionSyncFrame: number | null = null;

    const readLiveSelectionSnapshot = () => {
      const selection = contents.window.getSelection();
      const snapshot = selection ? createSelectionSnapshot(selection) : null;

      if (snapshot) {
        lastSelectionSnapshot = snapshot;
      }

      return snapshot;
    };

    const getSelectionSnapshot = () => {
      const liveSnapshot = readLiveSelectionSnapshot();
      if (liveSnapshot) {
        return liveSnapshot;
      }

      return isFreshSelectionSnapshot(lastSelectionSnapshot) ? lastSelectionSnapshot : null;
    };

    const handleContentsSelected = (cfiRange: string) => {
      lastSelectedCfiRange = {
        timestamp: Date.now(),
        value: cfiRange,
      };

      // Use a small delay to ensure the browser selection is fully materialized
      // before we try to capture it. The "selected" event can fire before
      // getSelection() returns the new selection in some cases.
      window.setTimeout(() => {
        const selectionSnapshot = getSelectionSnapshot();
        if (!selectionSnapshot) {
          return;
        }

        emitSelection(cfiRange, contents, selectionSnapshot);
      }, 0);
    };

    const syncSelectionFromDom = () => {
      const selection = contents.window.getSelection();
      const selectionSnapshot = selection ? createSelectionSnapshot(selection) : null;

      if (selectionSnapshot) {
        lastSelectionSnapshot = selectionSnapshot;
      }

      if (!selectionSnapshot) {
        lastSelectionSnapshot = null;
        lastSelectedCfiRange = null;

        if ((selection?.isCollapsed ?? true) && Date.now() >= suppressSelectionClearUntil) {
          onSelectionChange?.(null);
        }

        return;
      }

      try {
        const cfiRange =
          lastSelectedCfiRange &&
          Date.now() - lastSelectedCfiRange.timestamp <= SELECTION_SNAPSHOT_TTL_MS
            ? lastSelectedCfiRange.value
            : contents.cfiFromRange(selectionSnapshot.range);

        lastSelectedCfiRange = {
          timestamp: Date.now(),
          value: cfiRange,
        };
        emitSelection(cfiRange, contents, selectionSnapshot);
      } catch {}
    };

    const scheduleSelectionSync = () => {
      syncSelectionFromDom();

      if (selectionSyncFrame !== null) {
        window.cancelAnimationFrame(selectionSyncFrame);
      }

      selectionSyncFrame = window.requestAnimationFrame(() => {
        selectionSyncFrame = null;
        syncSelectionFromDom();
      });

      if (selectionSyncTimeout !== null) {
        window.clearTimeout(selectionSyncTimeout);
      }

      selectionSyncTimeout = window.setTimeout(() => {
        selectionSyncTimeout = null;
        syncSelectionFromDom();
      }, 32);
    };

    const handleMouseDown = () => {
      if (contents.window.getSelection()?.isCollapsed ?? true) {
        onSelectionChange?.(null);
      }
    };

    const handleMouseUp = () => {
      scheduleSelectionSync();
    };

    contents.on("selected", handleContentsSelected);
    contents.document.addEventListener("selectionchange", scheduleSelectionSync);
    contents.document.addEventListener("keydown", handleReaderKeyDown);
    contents.document.addEventListener("mousedown", handleMouseDown);
    contents.document.addEventListener("mouseup", handleMouseUp);
    contents.document.addEventListener("touchend", scheduleSelectionSync);

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

    injectTranslationsIntoContents(contents);
    applyHighlights();
    applyNotes();

    contentCleanupCallbacks.add(() => {
      contents.off("selected", handleContentsSelected);
      if (selectionSyncTimeout !== null) {
        window.clearTimeout(selectionSyncTimeout);
      }
      if (selectionSyncFrame !== null) {
        window.cancelAnimationFrame(selectionSyncFrame);
      }
      contents.document.removeEventListener("selectionchange", scheduleSelectionSync);
      contents.document.removeEventListener("keydown", handleReaderKeyDown);
      contents.document.removeEventListener("mousedown", handleMouseDown);
      contents.document.removeEventListener("mouseup", handleMouseUp);
      contents.document.removeEventListener("touchend", scheduleSelectionSync);
      clearInjectedTranslations(contents);
      clearInjectedNoteMarkers(contents);
      unlistenDocumentWheel();
      unlistenWindowWheel();
      unlistenBodyWheel();
      unlistenDocumentElementWheel();
    });
  });

  contentCleanupCallbacks.add(attachWheelNavigation(window, wheelNavigationHandler.handleWheel));
  contentCleanupCallbacks.add(attachWheelNavigation(container, wheelNavigationHandler.handleWheel));

  rendition.on("relocated", handleRelocated);
  window.addEventListener("keydown", handleReaderKeyDown);
  window.addEventListener("resize", handleResize);

  const refreshCurrentView = async () => {
    const currentLocation = await rendition.currentLocation();
    const currentCfi = currentLocation?.cfi ?? "";

    if (!currentCfi) {
      applyTranslations();
      applyHighlights();
      applyNotes();
      return;
    }

    await rendition.display(currentCfi);
  };

  const bridge: EpubBridge = {
    applyReadingSettings: (settings) => {
      const nextSignature = `${settings.theme}:${settings.font_family}:${settings.font_size}:${settings.line_height}`;
      if (nextSignature === lastAppliedSettingsSignature) {
        return;
      }

      lastAppliedSettingsSignature = nextSignature;
      currentReadingSettings = settings;
      applyReadingSettingsToRendition(rendition, settings);
      invalidateRenderedAnnotations();
      void refreshCurrentView().catch(() => undefined);
    },
    clearSelection,
    destroy: () => {
      if (destroyed) {
        return;
      }

      destroyed = true;
      rendition.off("relocated", handleRelocated);
      window.removeEventListener("keydown", handleReaderKeyDown);
      window.removeEventListener("resize", handleResize);
      wheelNavigationHandler.cleanup();
      contentCleanupCallbacks.forEach((cleanup) => cleanup());
      contentCleanupCallbacks.clear();
      rendition.destroy();
      epubBook.destroy();
    },
    goToCfi: (cfi) => rendition.display(cfi),
    goToHref: (href) => rendition.display(href),
    next: () => rendition.next(),
    prev: () => rendition.prev(),
    resolveAnnotationLocation,
    setHighlights: (highlights) => {
      currentHighlights = highlights;
      applyHighlights();
      applyNotes();
    },
    setNotes: (notes) => {
      currentNotes = notes;
      applyNotes();
    },
    setTranslations: ({ enabled, targetLanguage, translations }) => {
      const nextSignature = `${enabled}:${targetLanguage ?? ""}:${translations
        .map((translation) => `${translation.id}:${translation.paragraph_hash}`)
        .join("|")}`;

      if (nextSignature === lastAppliedTranslationSignature) {
        return;
      }

      lastAppliedTranslationSignature = nextSignature;
      bilingualModeEnabled = enabled;
      currentTranslations = new Map(
        translations.map((translation) => [
          getTranslationKey(translation.spine_item_href, translation.paragraph_index),
          translation,
        ]),
      );

      void refreshCurrentView().catch(() => undefined);
    },
  };

  try {
    await awaitWithTimeout(epubBook.ready, BOOK_READY_TIMEOUT_MS, "BOOK_READY_TIMEOUT");

    epubBook.spine.each((section: { href?: string; index?: number } | null) => {
      if (!section?.href || typeof section.index !== "number") {
        return;
      }

      spineHrefByIndex.set(section.index, normalizeHref(section.href));
    });

    const updateTocItems = (items: ReaderTocItem[]) => {
      tocItems = items;

      if (!initialDisplayComplete) {
        return;
      }

      onReady({
        bridge,
        toc: tocItems,
      });
      void syncCurrentLocation(rendition, handleRelocated).catch(() => undefined);
    };

    void epubBook.loaded.navigation
      .then((navigation) => {
        if (destroyed) {
          return;
        }

        updateTocItems(flattenTocItems(navigation?.toc ?? []));
      })
      .catch(() => undefined);

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

    const displayFromBeginning = async () => {
      if (beginningTarget) {
        try {
          await displayWithTimeout(rendition, beginningTarget);
          return;
        } catch {
          // fall through to epub.js default display below
        }
      }

      await displayWithTimeout(rendition);
    };

    if (savedCfi) {
      try {
        await displayWithTimeout(rendition, savedCfi);
      } catch {
        onPositionRestoreError?.();
        await displayFromBeginning();
      }
    } else {
      await displayFromBeginning();
    }

    initialDisplayComplete = true;
    onReady({
      bridge,
      toc: tocItems,
    });

    await syncCurrentLocation(rendition, handleRelocated);

    void epubBook.locations
      .generate(1024)
      .then(async () => {
        if (!destroyed) {
          invalidateRenderedAnnotations();
          await syncCurrentLocation(rendition, handleRelocated);
        }
      })
      .catch(() => undefined);
  } catch (error) {
    bridge.destroy();
    onError(toReaderError(error));
    throw error;
  }

  return bridge;
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
