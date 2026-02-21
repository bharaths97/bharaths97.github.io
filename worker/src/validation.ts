import type { ChatMessage, ChatRespondRequest } from './types';

export class ValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const USE_CASE_ID_PATTERN = /^[a-z0-9_-]{1,64}$/;
const USE_CASE_LOCK_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const isChatRole = (value: unknown): value is ChatMessage['role'] => {
  return value === 'user' || value === 'assistant';
};

const validateUseCaseId = (useCaseId: unknown): string | undefined => {
  if (typeof useCaseId === 'undefined') {
    return undefined;
  }

  if (typeof useCaseId !== 'string') {
    throw new ValidationError('Invalid use_case_id.');
  }

  const trimmed = useCaseId.trim();
  if (!trimmed || !USE_CASE_ID_PATTERN.test(trimmed)) {
    throw new ValidationError('Invalid use_case_id format.');
  }

  return trimmed;
};

const validateUseCaseLockToken = (token: unknown): string | undefined => {
  if (typeof token === 'undefined') {
    return undefined;
  }

  if (typeof token !== 'string') {
    throw new ValidationError('Invalid use_case_lock_token.');
  }

  const trimmed = token.trim();
  if (!trimmed || !USE_CASE_LOCK_TOKEN_PATTERN.test(trimmed)) {
    throw new ValidationError('Invalid use_case_lock_token format.');
  }

  return trimmed;
};

export const validateSessionId = (sessionId: unknown): string => {
  if (typeof sessionId !== 'string') {
    throw new ValidationError('Invalid session id.');
  }

  const trimmed = sessionId.trim();
  if (trimmed.length < 8 || trimmed.length > 256) {
    throw new ValidationError('Invalid session id length.');
  }

  return trimmed;
};

export const validateResetPayload = (body: unknown): { sessionId: string } => {
  if (!isObject(body)) {
    throw new ValidationError('Malformed request body.');
  }

  return {
    sessionId: validateSessionId(body.session_id)
  };
};

export const validateRespondPayload = (
  body: unknown,
  limits: {
    maxUserChars: number;
    maxContextMessages: number;
    maxContextChars: number;
    maxTurns: number;
  }
): ChatRespondRequest => {
  if (!isObject(body)) {
    throw new ValidationError('Malformed request body.');
  }

  const sessionId = validateSessionId(body.session_id);
  const rawMessages = body.messages;
  const useCaseId = validateUseCaseId(body.use_case_id);
  const useCaseLockToken = validateUseCaseLockToken(body.use_case_lock_token);

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    throw new ValidationError('Messages must be a non-empty array.');
  }

  if (rawMessages.length > limits.maxContextMessages * 2) {
    throw new ValidationError('Too many messages in context.');
  }

  const messages: ChatMessage[] = rawMessages.map((rawMessage, index) => {
    if (!isObject(rawMessage)) {
      throw new ValidationError(`Invalid message at index ${index}.`);
    }

    if (!isChatRole(rawMessage.role)) {
      throw new ValidationError(`Invalid message role at index ${index}.`);
    }

    if (typeof rawMessage.content !== 'string') {
      throw new ValidationError(`Invalid message content at index ${index}.`);
    }

    const content = rawMessage.content.trim();
    if (!content) {
      throw new ValidationError(`Empty message content at index ${index}.`);
    }

    if (rawMessage.role === 'user' && content.length > limits.maxUserChars) {
      throw new ValidationError(`User message at index ${index} exceeds max length.`);
    }

    const ts = typeof rawMessage.ts === 'string' ? rawMessage.ts : '';
    if (!ts || Number.isNaN(Date.parse(ts))) {
      throw new ValidationError(`Invalid message timestamp at index ${index}.`);
    }

    return {
      role: rawMessage.role,
      content,
      ts
    };
  });

  const userTurnCount = messages.filter((message) => message.role === 'user').length;
  if (userTurnCount > limits.maxTurns) {
    throw new ValidationError('Maximum turn limit exceeded.');
  }

  const totalContextChars = messages.reduce((total, message) => total + message.content.length, 0);
  if (totalContextChars > limits.maxContextChars) {
    throw new ValidationError('Context payload too large.');
  }

  if (messages[messages.length - 1]?.role !== 'user') {
    throw new ValidationError('Last message must be from user.');
  }

  return {
    session_id: sessionId,
    messages,
    use_case_id: useCaseId,
    use_case_lock_token: useCaseLockToken
  };
};
