"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type SVGProps,
} from "react";

type DemoRole = "user" | "assistant";
type DemoChannel = "chat" | "voice";

type DemoMessage = {
  id: string;
  role: DemoRole;
  content: string;
  channel: DemoChannel;
  pending?: boolean;
  error?: boolean;
};

type ApiMessage = {
  role: DemoRole;
  content: string;
};

const WELCOME_MESSAGE_ID = "welcome";

const INITIAL_MESSAGES: DemoMessage[] = [
  {
    id: WELCOME_MESSAGE_ID,
    role: "assistant",
    content: "Ready when you are.",
    channel: "chat",
  },
];

async function getSignedUrl(): Promise<string> {
  const response = await fetch("/api/token");

  if (!response.ok) {
    throw Error("Failed to get conversation signed URL");
  }

  const data = (await response.json()) as { signedUrl?: string };

  if (!data.signedUrl) {
    throw Error("Token response did not include a signed URL");
  }

  return data.signedUrl;
}

async function registerVoiceHistory(messages: ApiMessage[]) {
  if (messages.length === 0) {
    return null;
  }

  const response = await fetch("/api/voice-history", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    historyId?: string;
    error?: string;
  };

  if (!response.ok || !data.historyId) {
    throw new Error(data.error || "Failed to prepare voice history.");
  }

  return data.historyId;
}

async function linkVoiceHistory(historyId: string, conversationId: string) {
  const response = await fetch("/api/voice-history/link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ historyId, conversationId }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error || "Failed to link voice history.");
  }
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function roleLabel(role: DemoRole) {
  return role === "assistant" ? "Assistant" : "You";
}

function toApiMessages(messages: DemoMessage[]): ApiMessage[] {
  return messages
    .filter(
      (message) =>
        message.id !== WELCOME_MESSAGE_ID && !message.pending && !message.error,
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function buildVoiceContext(messages: DemoMessage[]) {
  return toApiMessages(messages)
    .slice(-12)
    .map((message) => `${roleLabel(message.role)}: ${message.content}`)
    .join("\n");
}

function appendOrUpdateVoiceMessage(
  messages: DemoMessage[],
  role: DemoRole,
  content: string,
  eventId?: number,
) {
  const id = eventId
    ? `voice-${role}-${eventId}`
    : createMessageId(`voice-${role}`);
  const existingIndex = messages.findIndex((message) => message.id === id);

  if (existingIndex === -1) {
    return [
      ...messages,
      {
        id,
        role,
        content,
        channel: "voice" as const,
      },
    ];
  }

  return messages.map((message, index) =>
    index === existingIndex ? { ...message, content } : message,
  );
}

function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="m4 12 15-7-4 14-3.2-5.4L4 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m11.8 13.6 3.9-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MicIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 0 0-7 0v4a3.5 3.5 0 0 0 3.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 10.5a7 7 0 0 0 14 0M12 17.5V21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StopIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8 8h8v8H8V8Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ConversationView() {
  const [messages, setMessages] = useState<DemoMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const voiceHistoryIdRef = useRef<string | null>(null);
  const linkedVoiceConversationIdsRef = useRef<Set<string>>(new Set());
  const pendingTypedVoiceMessagesRef = useRef<string[]>([]);

  const linkActiveVoiceHistory = useCallback(async (conversationId?: string) => {
    const historyId = voiceHistoryIdRef.current;

    if (
      !historyId ||
      !conversationId ||
      linkedVoiceConversationIdsRef.current.has(conversationId)
    ) {
      return;
    }

    await linkVoiceHistory(historyId, conversationId);
    linkedVoiceConversationIdsRef.current.add(conversationId);
  }, []);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      setVoiceError(null);
      void linkActiveVoiceHistory(conversationId).catch((error: unknown) => {
        setVoiceError(getErrorMessage(error));
      });
    },
    onError: (message) => setVoiceError(message),
    onMessage: ({ role, message, event_id }) => {
      const content = message.trim();

      if (!content) {
        return;
      }

      if (role === "user") {
        const pendingIndex =
          pendingTypedVoiceMessagesRef.current.indexOf(content);

        if (pendingIndex !== -1) {
          pendingTypedVoiceMessagesRef.current.splice(pendingIndex, 1);
          return;
        }
      }

      setMessages((currentMessages) =>
        appendOrUpdateVoiceMessage(
          currentMessages,
          role === "agent" ? "assistant" : "user",
          content,
          event_id,
        ),
      );
    },
  });

  const chatHistory = useMemo(() => toApiMessages(messages), [messages]);
  const voiceContext = useMemo(() => buildVoiceContext(messages), [messages]);
  const isVoiceConnected = conversation.status === "connected";
  const isVoiceStarting = conversation.status === "connecting";
  const canStartVoice = conversation.status === "disconnected";
  const voiceStatusLabel =
    conversation.status === "connected" ? conversation.mode : conversation.status;
  const headerStatus = isVoiceConnected
    ? voiceStatusLabel
    : isVoiceStarting
      ? "connecting"
      : "chat";

  useEffect(() => {
    const thread = threadRef.current;

    if (!thread) {
      return;
    }

    thread.scrollTo({
      top: thread.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const sendChatMessage = useCallback(async () => {
    const content = draft.trim();

    if (!content || isSending) {
      return;
    }

    const userMessage: DemoMessage = {
      id: createMessageId(isVoiceConnected ? "voice-user-typed" : "chat-user"),
      role: "user",
      content,
      channel: isVoiceConnected ? "voice" : "chat",
    };

    if (isVoiceConnected) {
      try {
        pendingTypedVoiceMessagesRef.current.push(content);
        conversation.sendUserMessage(content);
        setMessages((currentMessages) => [...currentMessages, userMessage]);
        setDraft("");
        setChatError(null);
        setVoiceError(null);
      } catch (error: unknown) {
        pendingTypedVoiceMessagesRef.current =
          pendingTypedVoiceMessagesRef.current.filter(
            (pendingContent) => pendingContent !== content,
          );
        setVoiceError(getErrorMessage(error));
      }

      return;
    }

    const pendingAssistantId = createMessageId("chat-assistant");
    const pendingAssistant: DemoMessage = {
      id: pendingAssistantId,
      role: "assistant",
      content: "Thinking...",
      channel: "chat",
      pending: true,
    };
    const nextHistory = [...chatHistory, { role: "user" as const, content }];

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      pendingAssistant,
    ]);
    setDraft("");
    setIsSending(true);
    setChatError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextHistory }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        throw new Error(data.details || data.error || "Chat request failed.");
      }

      if (!data.message) {
        throw new Error("Chat response did not include a message.");
      }

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === pendingAssistantId
            ? { ...message, content: data.message ?? "", pending: false }
            : message,
        ),
      );
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      setChatError(message);
      setMessages((currentMessages) =>
        currentMessages.map((currentMessage) =>
          currentMessage.id === pendingAssistantId
            ? {
                ...currentMessage,
                content: message,
                pending: false,
                error: true,
              }
            : currentMessage,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }, [chatHistory, conversation, draft, isSending, isVoiceConnected]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void sendChatMessage();
    },
    [sendChatMessage],
  );

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendChatMessage();
      }
    },
    [sendChatMessage],
  );

  const startVoiceMode = useCallback(async () => {
    if (isVoiceConnected || isVoiceStarting) {
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not available in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      const historyId = await registerVoiceHistory(chatHistory);
      const signedUrl = await getSignedUrl();
      const context = voiceContext;

      voiceHistoryIdRef.current = historyId;
      linkedVoiceConversationIdsRef.current.clear();

      conversation.startSession({
        signedUrl,
        onConversationCreated: (voiceConversation) => {
          void linkActiveVoiceHistory(voiceConversation.getId()).catch(
            (error: unknown) => {
              setVoiceError(getErrorMessage(error));
            },
          );

          if (context) {
            voiceConversation.sendContextualUpdate(
              `Typed chat before voice mode:\n${context}`,
              { contextId: "typed-chat-history" },
            );
          }
        },
      });
      setVoiceError(null);
    } catch (error: unknown) {
      setVoiceError(getErrorMessage(error));
    }
  }, [
    chatHistory,
    conversation,
    isVoiceConnected,
    isVoiceStarting,
    linkActiveVoiceHistory,
    voiceContext,
  ]);

  const stopVoiceMode = useCallback(() => {
    conversation.endSession();
  }, [conversation]);

  return (
    <main className="h-dvh overflow-hidden bg-white text-zinc-950">
      <section className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-4 sm:px-6">
        <header className="shrink-0 flex items-center justify-between gap-3 border-b border-zinc-200 py-3">
          <div>
            <h1 className="text-base font-semibold">Assistant</h1>
            <p className="mt-0.5 text-xs text-zinc-500">{headerStatus}</p>
          </div>

          <div className="flex items-center gap-2">
            {isVoiceConnected ? (
              <>
                <button
                  type="button"
                  onClick={() => conversation.setMuted(!conversation.isMuted)}
                  className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  {conversation.isMuted ? "Unmute" : "Mute"}
                </button>
                <button
                  type="button"
                  onClick={stopVoiceMode}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800"
                  aria-label="End voice"
                >
                  <StopIcon className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                {isVoiceStarting ? (
                  <span className="text-xs text-zinc-500">Connecting</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void startVoiceMode()}
                  disabled={!canStartVoice}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
                  aria-label="Start voice"
                >
                  <MicIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </header>

        {(chatError || voiceError) && (
          <div className="mt-3 shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {chatError || voiceError}
          </div>
        )}

        <div
          data-chat-thread
          ref={threadRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth py-6 pr-1"
        >
          <div className="flex min-h-full flex-col justify-end gap-4">
            {messages.map((message) => {
              const isAssistant = message.role === "assistant";

              return (
                <article
                  key={message.id}
                  className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.error
                        ? "bg-red-50 text-red-700"
                        : isAssistant
                          ? "bg-zinc-100 text-zinc-900"
                          : "bg-zinc-950 text-white"
                    }`}
                  >
                    <p className="mb-1 text-[0.68rem] font-medium uppercase tracking-wide opacity-50">
                      {roleLabel(message.role)}
                      {message.channel === "voice" ? " / voice" : ""}
                    </p>
                    <p>{message.content}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-zinc-200 py-3"
        >
          <div className="flex items-end gap-2">
            <label htmlFor="chat-message" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={1}
              placeholder="Message"
              className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
            />
            <button
              type="submit"
              disabled={!draft.trim() || isSending}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200"
              aria-label="Send message"
            >
              <SendIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <ConversationProvider>
      <ConversationView />
    </ConversationProvider>
  );
}
