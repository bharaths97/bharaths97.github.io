import type { ChatMessage, ChatUseCaseState } from '../types/chat';

const ACTIVE_SESSION_KEY = 'chat:v1:activeSessionId';
const SESSION_MESSAGES_PREFIX = 'chat:v1:messages:';
const SESSION_USE_CASE_PREFIX = 'chat:v1:useCase:';

const getSessionMessagesKey = (sessionId: string): string => `${SESSION_MESSAGES_PREFIX}${sessionId}`;
const getSessionUseCaseKey = (sessionId: string): string => `${SESSION_USE_CASE_PREFIX}${sessionId}`;

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

export const loadSessionUseCaseState = (sessionId: string): ChatUseCaseState => {
  const raw = sessionStorage.getItem(getSessionUseCaseKey(sessionId));
  if (!raw) {
    return {
      useCaseId: null,
      memoryMode: null,
      useCaseLockToken: null,
      isLocked: false
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ChatUseCaseState>;
    const memoryMode =
      parsed.memoryMode === 'classic' || parsed.memoryMode === 'tiered' ? parsed.memoryMode : null;
    return {
      useCaseId: typeof parsed.useCaseId === 'string' ? parsed.useCaseId : null,
      memoryMode,
      useCaseLockToken: typeof parsed.useCaseLockToken === 'string' ? parsed.useCaseLockToken : null,
      isLocked: parsed.isLocked === true
    };
  } catch {
    return {
      useCaseId: null,
      memoryMode: null,
      useCaseLockToken: null,
      isLocked: false
    };
  }
};

export const saveSessionUseCaseState = (sessionId: string, value: ChatUseCaseState): void => {
  sessionStorage.setItem(getSessionUseCaseKey(sessionId), JSON.stringify(value));
};

export const clearSessionUseCaseState = (sessionId: string): void => {
  sessionStorage.removeItem(getSessionUseCaseKey(sessionId));
};

export const clearAllChatStorage = (): void => {
  clearActiveSessionId();

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(SESSION_MESSAGES_PREFIX)) {
      sessionStorage.removeItem(key);
      continue;
    }

    if (key?.startsWith(SESSION_USE_CASE_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  }
};
