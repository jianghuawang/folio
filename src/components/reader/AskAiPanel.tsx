import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Square } from "lucide-react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAskAi } from "@/hooks/useAskAi";
import type { AskAiError } from "@/hooks/useAskAi";
import {
  divider,
  errorBox,
  inputSurface,
  panelAnimation,
  panelMuted,
  panelNotch,
  panelSurface,
  resolveChromeTheme,
  Z,
} from "@/lib/panel-chrome";
import type { ReaderPopupPosition } from "@/store/readerStore";
import type { ReadingTheme } from "@/types/settings";

interface AskAiPanelProps {
  bookId: string;
  contextText: string;
  onClose: () => void;
  passage: string;
  position: ReaderPopupPosition;
  theme?: ReadingTheme;
}

function resolveErrorMessage(error: AskAiError): string {
  switch (error.code) {
    case "NO_API_KEY":
    case "INVALID_API_KEY":
      return "Invalid API key. Check your key in Settings.";
    case "RATE_LIMITED":
      return error.retryAfterSecs
        ? `Rate limit reached. Try again in ${error.retryAfterSecs}s.`
        : "Rate limit reached. Try again shortly.";
    case "NETWORK_ERROR":
      return "Network error. Check your connection and try again.";
    default:
      return "The AI could not answer. Try again.";
  }
}

export function AskAiPanel({
  bookId,
  contextText,
  onClose,
  passage,
  position,
  theme = "light",
}: AskAiPanelProps) {
  const chromeTheme = resolveChromeTheme(theme);
  const proseClassName = `whitespace-pre-wrap text-[14px] leading-6 ${
    chromeTheme === "dark" ? "text-white/85" : "text-black/80"
  }`;
  const { ask, error, messages, retry, status, stop, streamingText } = useAskAi(bookId);
  const [question, setQuestion] = useState("");
  const [measuredHeight, setMeasuredHeight] = useState(240);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const isStreaming = status === "streaming";
  const hasConversation = messages.length > 0 || isStreaming;

  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [onClose, stop]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamingText, error]);

  // Clamp against the panel's real height (it grows as the thread does)
  // instead of a fixed estimate, so it opens tight to the selection.
  useLayoutEffect(() => {
    const element = panelRef.current;
    if (!element) {
      return undefined;
    }

    const measure = () => setMeasuredHeight(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const handleSend = () => {
    const trimmed = question.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    ask(trimmed, { contextText, passage });
    setQuestion("");
  };

  const viewportPadding = 24;
  const popupWidth =
    typeof window === "undefined" ? 460 : Math.min(460, window.innerWidth - 32);
  const clampedLeft =
    typeof window === "undefined"
      ? position.left
      : Math.min(
          Math.max(position.left, viewportPadding + popupWidth / 2),
          window.innerWidth - viewportPadding - popupWidth / 2,
        );
  const clampedTop =
    typeof window === "undefined"
      ? position.top
      : Math.max(
          88,
          Math.min(
            position.top - 18,
            window.innerHeight - viewportPadding - measuredHeight,
          ),
        );
  // Keep the notch pointing at the selection even when the panel is clamped
  // at a viewport edge. The wrapper has 4px horizontal padding on each side.
  const notchContainerWidth = popupWidth - 8;
  const notchLeft = Math.min(
    Math.max(position.left - (clampedLeft - notchContainerWidth / 2), 28),
    notchContainerWidth - 28,
  );

  return createPortal(
    <div className={`fixed inset-0 ${Z.popup}`} onMouseDown={handleClose}>
      <div
        data-folio-ask-ai="true"
        className="absolute w-[min(460px,calc(100vw-32px))] px-1"
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          left: clampedLeft,
          top: clampedTop,
          transform: "translateX(-50%)",
        }}
      >
        <div className={`relative ${panelAnimation}`}>
          <div
            className={panelNotch(chromeTheme)}
            style={{ left: notchLeft }}
          />

          <div
            ref={panelRef}
            className={`max-h-[72vh] overflow-y-auto p-5 ${panelSurface(chromeTheme)}`}
          >
            <p className={`line-clamp-3 text-sm italic leading-6 ${chromeTheme === "dark" ? "text-white/55" : "text-black/55"}`}>
              &quot;{passage}&quot;
            </p>
            <div className={`mt-4 h-px ${divider(chromeTheme)}`} />

            {hasConversation ? (
              <div className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
                {messages.map((message, index) =>
                  message.role === "user" ? (
                    <div key={index} className="flex justify-end">
                      <p className={`max-w-[85%] rounded-lg px-4 py-2 text-[14px] leading-6 ${chromeTheme === "dark" ? "bg-white/[0.08] text-white/85" : "bg-black/[0.06] text-black/80"}`}>
                        {message.content}
                      </p>
                    </div>
                  ) : (
                    <p
                      key={index}
                      className={proseClassName}
                    >
                      {message.content}
                    </p>
                  ),
                )}

                {isStreaming ? (
                  streamingText ? (
                    <p className={proseClassName}>
                      {streamingText}
                      <span className={`ml-0.5 inline-block h-4 w-[2px] animate-pulse align-middle ${chromeTheme === "dark" ? "bg-white/70" : "bg-black/60"}`} />
                    </p>
                  ) : (
                    <p className={`flex items-center gap-2 ${panelMuted(chromeTheme)}`}>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Thinking…
                    </p>
                  )
                ) : null}

                <div ref={scrollAnchorRef} />
              </div>
            ) : (
              <p className={`mt-4 leading-5 ${panelMuted(chromeTheme)}`}>
                Ask anything about this passage — its meaning, the characters, or the context.
              </p>
            )}

            {status === "error" && error ? (
              <div className={`mt-4 flex items-center justify-between gap-3 px-3 py-2 ${errorBox(chromeTheme)}`}>
                <p className="text-[12px] leading-5">{resolveErrorMessage(error)}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="shrink-0 text-[12px] font-medium underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            ) : null}

            <div className="mt-4 flex items-end gap-2">
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                className={`min-h-[44px] resize-none px-4 py-2.5 text-[14px] leading-6 focus-visible:ring-[#0A84FF] ${inputSurface(chromeTheme)}`}
                placeholder="Ask about this passage…"
                autoFocus
              />
              {isStreaming ? (
                <Button
                  type="button"
                  className="h-[44px] w-[44px] shrink-0 rounded-full bg-black p-0 text-white hover:bg-black/85"
                  onClick={stop}
                  aria-label="Stop answering"
                >
                  <Square className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-[44px] w-[44px] shrink-0 rounded-full bg-black p-0 text-white hover:bg-black/85 disabled:bg-black/20 disabled:text-white/80"
                  onClick={handleSend}
                  disabled={!question.trim()}
                  aria-label="Send question"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
