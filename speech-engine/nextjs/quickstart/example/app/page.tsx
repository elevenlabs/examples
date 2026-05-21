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
} from "react";

import { VOICE_FIRST_MESSAGE } from "@/lib/assistant-constants";

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
    .filter(message => !message.pending && !message.error)
    .map(message => ({
      role: message.role,
      content: message.content,
    }));
}

function buildVoiceContext(messages: DemoMessage[]) {
  return toApiMessages(messages)
    .slice(-12)
    .map(message => `${roleLabel(message.role)}: ${message.content}`)
    .join("\n");
}

function appendOrUpdateVoiceMessage(
  messages: DemoMessage[],
  role: DemoRole,
  content: string,
  eventId?: number
) {
  const id =
    eventId != null
      ? `voice-${role}-${eventId}`
      : createMessageId(`voice-${role}`);
  const existingIndex = messages.findIndex(message => message.id === id);

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
    index === existingIndex ? { ...message, content } : message
  );
}

async function getConversationToken() {
  const response = await fetch("/api/token");
  const data = (await response.json().catch(() => ({}))) as {
    token?: string;
    error?: string;
    details?: string;
  };

  if (!response.ok || !data.token) {
    throw new Error(
      data.details || data.error || "Failed to get a conversation token."
    );
  }

  return data.token;
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
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "Failed to link voice history.");
  }
}

function ConversationView() {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const voiceHistoryIdRef = useRef<string | null>(null);
  const linkedVoiceConversationIdsRef = useRef<Set<string>>(new Set());
  const pendingTypedVoiceMessagesRef = useRef<string[]>([]);

  const conversation = useConversation({
    onConnect: () => {
      setVoiceError(null);
    },
    onDisconnect: details => {
      if (details.reason === "error") {
        setVoiceError(details.message);
        return;
      }

      if (details.reason === "agent") {
        const reason =
          "closeReason" in details && details.closeReason
            ? details.closeReason
            : null;

        if (reason) {
          setVoiceError(reason);
        }
      }
    },
    onError: message => {
      setVoiceError(message);
    },
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

      setMessages(currentMessages =>
        appendOrUpdateVoiceMessage(
          currentMessages,
          role === "agent" ? "assistant" : "user",
          content,
          event_id
        )
      );
    },
  });

  const chatHistory = useMemo(() => toApiMessages(messages), [messages]);
  const voiceContext = useMemo(() => buildVoiceContext(messages), [messages]);
  const isVoiceConnected = conversation.status === "connected";
  const isVoiceStarting = conversation.status === "connecting";
  const canStartVoice = conversation.status === "disconnected";
  const connectionStatus = isVoiceConnected
    ? conversation.mode === "speaking"
      ? "Voice connected - speaking"
      : "Voice connected - listening"
    : isVoiceStarting
      ? "Voice connecting"
      : "Chat only";

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
        setMessages(currentMessages => [...currentMessages, userMessage]);
        setDraft("");
        setChatError(null);
        setVoiceError(null);
      } catch (error: unknown) {
        pendingTypedVoiceMessagesRef.current =
          pendingTypedVoiceMessagesRef.current.filter(
            pendingContent => pendingContent !== content
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

    setMessages(currentMessages => [
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

      setMessages(currentMessages =>
        currentMessages.map(message =>
          message.id === pendingAssistantId
            ? { ...message, content: data.message ?? "", pending: false }
            : message
        )
      );
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      setChatError(message);
      setMessages(currentMessages =>
        currentMessages.map(currentMessage =>
          currentMessage.id === pendingAssistantId
            ? {
                ...currentMessage,
                content: message,
                pending: false,
                error: true,
              }
            : currentMessage
        )
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
    [sendChatMessage]
  );

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendChatMessage();
      }
    },
    [sendChatMessage]
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
      stream.getTracks().forEach(track => track.stop());

      const historyId = await registerVoiceHistory(chatHistory);
      const token = await getConversationToken();
      const context = voiceContext;

      voiceHistoryIdRef.current = historyId;
      linkedVoiceConversationIdsRef.current.clear();
      setVoiceError(null);

      await conversation.startSession({
        conversationToken: token,
        overrides: {
          agent: {
            firstMessage: VOICE_FIRST_MESSAGE,
          },
        },
        onConversationCreated: voiceConversation => {
          const conversationId = voiceConversation.getId();
          const activeHistoryId = voiceHistoryIdRef.current;

          if (
            activeHistoryId &&
            !linkedVoiceConversationIdsRef.current.has(conversationId)
          ) {
            void linkVoiceHistory(activeHistoryId, conversationId)
              .then(() => {
                linkedVoiceConversationIdsRef.current.add(conversationId);
              })
              .catch((error: unknown) => {
                setVoiceError(getErrorMessage(error));
              });
          }

          if (context) {
            voiceConversation.sendContextualUpdate(
              `Typed chat before voice mode:\n${context}`,
              { contextId: "typed-chat-history" }
            );
          }
        },
      });
    } catch (error: unknown) {
      setVoiceError(getErrorMessage(error));
    }
  }, [
    chatHistory,
    conversation,
    isVoiceConnected,
    isVoiceStarting,
    voiceContext,
  ]);

  const stopVoiceMode = useCallback(() => {
    conversation.endSession();
  }, [conversation]);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Voice & Chat Agent
          </h1>
          <p className="text-sm text-neutral-500">
            Live speech-to-text & text-to-speech with Speech Engine.
          </p>
          <p className="text-xs text-neutral-400">{connectionStatus}</p>
        </header>

        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {isVoiceConnected ? (
              <>
                <button
                  type="button"
                  onClick={() => conversation.setMuted(!conversation.isMuted)}
                  className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                >
                  {conversation.isMuted ? "Unmute" : "Mute"}
                </button>
                <button
                  type="button"
                  onClick={stopVoiceMode}
                  className="rounded-md border border-neutral-900 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                >
                  Stop voice
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void startVoiceMode()}
                disabled={!canStartVoice}
                className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400"
              >
                {isVoiceStarting ? "Starting voice..." : "Start voice"}
              </button>
            )}
          </div>

          {chatError ? (
            <p className="text-sm text-red-600">Chat error: {chatError}</p>
          ) : null}

          {voiceError ? (
            <p className="text-sm text-red-600">Voice error: {voiceError}</p>
          ) : null}

          <div
            ref={threadRef}
            className="max-h-[28rem] overflow-y-auto border-y border-neutral-200 py-4"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Start with a typed message, then switch to voice without losing
                context.
              </p>
            ) : (
              <div className="space-y-4">
                {messages.map(message => {
                  const isAssistant = message.role === "assistant";

                  return (
                    <article
                      key={message.id}
                      className={`flex ${
                        isAssistant ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-md px-4 py-3 text-sm leading-6 ${
                          message.error
                            ? "bg-red-50 text-red-700"
                            : isAssistant
                              ? "bg-neutral-100 text-neutral-900"
                              : "bg-neutral-900 text-white"
                        }`}
                      >
                        <p className="text-xs text-neutral-400">
                          {roleLabel(message.role)}
                          {message.channel === "voice" ? " / voice" : ""}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            <label htmlFor="chat-message" className="text-xs text-neutral-400">
              Message
            </label>
            <div className="flex items-end gap-3">
              <textarea
                id="chat-message"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={3}
                placeholder={
                  isVoiceConnected
                    ? "Type while voice mode is active..."
                    : "Ask anything..."
                }
                className="min-h-24 flex-1 resize-y rounded-md border border-neutral-200 px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-400"
              />
              <button
                type="submit"
                disabled={!draft.trim() || isSending}
                className="rounded-md border border-neutral-900 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
              >
                Send
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <ConversationProvider>
      <ConversationView />
    </ConversationProvider>
  );
}
