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

const isAccessLogoutPath = (url: string): boolean => url.includes('/cdn-cgi/access/logout');

const appendReturnTo = (logoutUrl: string, returnTo: string): string => {
  try {
    const url = new URL(logoutUrl, window.location.origin);
    if (!url.searchParams.has('returnTo')) {
      url.searchParams.set('returnTo', returnTo);
    }
    return url.toString();
  } catch {
    return logoutUrl;
  }
};

export const getChatLogoutUrl = (): string => {
  const returnTo = new URL('/', window.location.href).toString();

  if (rawLogoutUrl) {
    if (rawLogoutUrl === '/') return '/';
    return isAccessLogoutPath(rawLogoutUrl) ? appendReturnTo(rawLogoutUrl, returnTo) : rawLogoutUrl;
  }

  if (apiBaseUrl) {
    return appendReturnTo(`${apiBaseUrl}/cdn-cgi/access/logout`, returnTo);
  }

  return '/';
};

export const isExternalChatApiConfigured = (): boolean => Boolean(apiBaseUrl);
