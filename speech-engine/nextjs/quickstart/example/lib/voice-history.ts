import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { normalizeChatMessages, type ChatMessage } from "@/lib/assistant";

type VoiceHistoryStore = {
  histories: Record<string, ChatMessage[]>;
  links: Record<string, string>;
};

const HISTORY_FILE = ".next/cache/voice-history.json";

async function readStore(): Promise<VoiceHistoryStore> {
  try {
    const contents = await readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(contents) as Partial<VoiceHistoryStore>;

    return {
      histories: parsed.histories ?? {},
      links: parsed.links ?? {},
    };
  } catch {
    return {
      histories: {},
      links: {},
    };
  }
}

async function writeStore(store: VoiceHistoryStore) {
  await mkdir(dirname(HISTORY_FILE), { recursive: true });
  await writeFile(HISTORY_FILE, JSON.stringify(store), "utf8");
}

export async function createVoiceHistory(messages: ChatMessage[]) {
  const historyId = randomUUID();
  const store = await readStore();

  store.histories[historyId] = normalizeChatMessages(messages);
  await writeStore(store);

  return historyId;
}

export async function linkVoiceHistory(
  conversationId: string,
  historyId: string
) {
  const store = await readStore();

  if (!store.histories[historyId]) {
    return false;
  }

  store.links[conversationId] = historyId;
  await writeStore(store);

  return true;
}

export async function loadVoiceHistory(conversationId: string) {
  const store = await readStore();
  const historyId = store.links[conversationId];

  if (!historyId) {
    return [];
  }

  return store.histories[historyId] ?? [];
}
