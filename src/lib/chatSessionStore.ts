import type { ChatMessage } from '../types/chat';

const ACTIVE_SESSION_KEY = 'chat:v1:activeSessionId';
const SESSION_MESSAGES_PREFIX = 'chat:v1:messages:';

const getSessionMessagesKey = (sessionId: string): string => `${SESSION_MESSAGES_PREFIX}${sessionId}`;

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ChatMessage>;
  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string' &&
    typeof candidate.createdAt === 'string'
  );
};

export const getActiveSessionId = (): string | null => sessionStorage.getItem(ACTIVE_SESSION_KEY);

export const setActiveSessionId = (sessionId: string): void => {
  sessionStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
};

export const clearActiveSessionId = (): void => {
  sessionStorage.removeItem(ACTIVE_SESSION_KEY);
};

export const loadSessionMessages = (sessionId: string): ChatMessage[] => {
  const raw = sessionStorage.getItem(getSessionMessagesKey(sessionId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isChatMessage);
  } catch {
    return [];
  }
};

export const saveSessionMessages = (sessionId: string, messages: ChatMessage[]): void => {
  sessionStorage.setItem(getSessionMessagesKey(sessionId), JSON.stringify(messages));
};

export const clearSessionMessages = (sessionId: string): void => {
  sessionStorage.removeItem(getSessionMessagesKey(sessionId));
};

export const clearAllChatStorage = (): void => {
  clearActiveSessionId();

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(SESSION_MESSAGES_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  }
};
