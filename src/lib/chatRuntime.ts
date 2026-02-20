const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const rawApiBaseUrl = (import.meta.env.VITE_CHAT_API_BASE_URL || '').trim();
const rawLogoutUrl = (import.meta.env.VITE_CHAT_LOGOUT_URL || '').trim();

const apiBaseUrl = rawApiBaseUrl ? trimTrailingSlash(rawApiBaseUrl) : '';

export const buildChatApiUrl = (path: string): string => {
  if (!path.startsWith('/')) {
    throw new Error('Chat API path must start with "/".');
  }

  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};

export const getChatLogoutUrl = (): string => {
  if (rawLogoutUrl) return rawLogoutUrl;
  if (apiBaseUrl) return `${apiBaseUrl}/cdn-cgi/access/logout`;
  return '/cdn-cgi/access/logout';
};

export const isExternalChatApiConfigured = (): boolean => Boolean(apiBaseUrl);
