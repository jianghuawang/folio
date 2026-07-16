import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import { askQuestion, cancelAsk, FolioError } from "@/lib/tauri-commands";
import type { AskCompleteEvent, AskDeltaEvent, AskErrorEvent } from "@/types/events";

export interface AskAiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AskAiError {
  code: string;
  message: string;
  retryAfterSecs?: number;
}

export type AskAiStatus = "idle" | "streaming" | "error";

interface AskContext {
  contextText: string;
  passage: string;
}

export function useAskAi(bookId: string | null) {
  const [messages, setMessages] = useState<AskAiMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [status, setStatus] = useState<AskAiStatus>("idle");
  const [error, setError] = useState<AskAiError | null>(null);

  const activeRequestIdRef = useRef<string | null>(null);
  // Ref mirrors of streamed/message state so event listeners and send logic
  // read current values without stale closures or async updater timing.
  const messagesRef = useRef<AskAiMessage[]>([]);
  const streamingTextRef = useRef("");
  const lastQuestionRef = useRef<{ question: string; context: AskContext } | null>(null);

  const replaceMessages = useCallback((nextMessages: AskAiMessage[]) => {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }, []);

  const appendDelta = useCallback((delta: string) => {
    streamingTextRef.current += delta;
    setStreamingText(streamingTextRef.current);
  }, []);

  const finalizeStreamingText = useCallback(() => {
    const finalText = streamingTextRef.current;
    streamingTextRef.current = "";
    setStreamingText("");

    if (finalText) {
      replaceMessages([...messagesRef.current, { role: "assistant", content: finalText }]);
    }
  }, [replaceMessages]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;

    const registerListeners = async () => {
      const unlistenCallbacks: Array<() => void> = [];

      try {
        const unlistenDelta = await listen<AskDeltaEvent>("ask:delta", (event) => {
          const trackedRequestId = activeRequestIdRef.current;
          if (!active || !trackedRequestId || event.payload.request_id !== trackedRequestId) {
            return;
          }

          appendDelta(event.payload.delta);
        });
        unlistenCallbacks.push(unlistenDelta);

        const unlistenComplete = await listen<AskCompleteEvent>("ask:complete", (event) => {
          const trackedRequestId = activeRequestIdRef.current;
          if (!active || !trackedRequestId || event.payload.request_id !== trackedRequestId) {
            return;
          }

          activeRequestIdRef.current = null;
          finalizeStreamingText();
          setStatus("idle");
        });
        unlistenCallbacks.push(unlistenComplete);

        const unlistenError = await listen<AskErrorEvent>("ask:error", (event) => {
          const trackedRequestId = activeRequestIdRef.current;
          if (!active || !trackedRequestId || event.payload.request_id !== trackedRequestId) {
            return;
          }

          activeRequestIdRef.current = null;
          finalizeStreamingText();
          setStatus("error");
          setError({
            code: event.payload.code,
            message: event.payload.message,
            retryAfterSecs: event.payload.retry_after_secs,
          });
        });
        unlistenCallbacks.push(unlistenError);

        return () => {
          unlistenCallbacks.forEach((unlisten) => unlisten());
        };
      } catch {
        unlistenCallbacks.forEach((unlisten) => unlisten());
        return () => undefined;
      }
    };

    void registerListeners().then((nextCleanup) => {
      if (!active) {
        nextCleanup();
        return;
      }

      cleanup = nextCleanup;
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [appendDelta, finalizeStreamingText]);

  const sendQuestion = useCallback(
    async (question: string, context: AskContext, history: AskAiMessage[]) => {
      if (!bookId) {
        return;
      }

      const requestId = crypto.randomUUID();
      activeRequestIdRef.current = requestId;
      streamingTextRef.current = "";
      setStreamingText("");
      setError(null);
      setStatus("streaming");

      try {
        await askQuestion({
          requestId,
          bookId,
          selectionText: context.passage,
          contextText: context.contextText,
          question,
          history,
        });
      } catch (invokeError) {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        activeRequestIdRef.current = null;
        setStatus("error");
        setError({
          code: invokeError instanceof FolioError ? invokeError.code : "ASK_FAILED",
          message: invokeError instanceof Error ? invokeError.message : String(invokeError),
        });
      }
    },
    [bookId],
  );

  const ask = useCallback(
    (question: string, context: AskContext) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || status === "streaming") {
        return;
      }

      lastQuestionRef.current = { question: trimmedQuestion, context };
      const history = messagesRef.current;
      replaceMessages([...history, { role: "user", content: trimmedQuestion }]);
      void sendQuestion(trimmedQuestion, context, history);
    },
    [replaceMessages, sendQuestion, status],
  );

  const retry = useCallback(() => {
    const lastQuestion = lastQuestionRef.current;
    if (!lastQuestion || status === "streaming") {
      return;
    }

    // The failed exchange already appended the user turn (and possibly a
    // partial answer); resend with the history that precedes it.
    const current = messagesRef.current;
    const lastUserIndex = current.map((message) => message.role).lastIndexOf("user");
    const history = lastUserIndex >= 0 ? current.slice(0, lastUserIndex) : current;
    replaceMessages([...history, { role: "user", content: lastQuestion.question }]);
    setError(null);
    void sendQuestion(lastQuestion.question, lastQuestion.context, history);
  }, [replaceMessages, sendQuestion, status]);

  const stop = useCallback(() => {
    const requestId = activeRequestIdRef.current;
    if (!requestId) {
      return;
    }

    activeRequestIdRef.current = null;
    void cancelAsk(requestId).catch(() => undefined);
    finalizeStreamingText();
    setStatus("idle");
  }, [finalizeStreamingText]);

  return {
    ask,
    error,
    messages,
    retry,
    status,
    stop,
    streamingText,
  };
}
