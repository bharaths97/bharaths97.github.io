const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');
const isLocalHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';

const rawApiBaseUrl = (import.meta.env.VITE_CHAT_API_BASE_URL || '').trim();
const rawLogoutUrl = (import.meta.env.VITE_CHAT_LOGOUT_URL || '').trim();
const rawLogoutReturnTo = (import.meta.env.VITE_CHAT_LOGOUT_RETURN_TO || '').trim();
const DEFAULT_PUBLIC_HOME = 'https://bharaths97.github.io/';

const apiBaseUrl = rawApiBaseUrl ? trimTrailingSlash(rawApiBaseUrl) : '';

export const buildChatApiUrl = (path: string): string => {
  if (!path.startsWith('/')) {
    throw new Error('Chat API path must start with "/".');
  }

  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};

const isAccessLogoutPath = (url: string): boolean => url.includes('/cdn-cgi/access/logout');

const getLogoutReturnTo = (): string => {
  if (rawLogoutReturnTo) {
    try {
      return new URL(rawLogoutReturnTo).toString();
    } catch {
      // Fall through to derived default.
    }
  }

  if (isLocalHost(window.location.hostname)) {
    return DEFAULT_PUBLIC_HOME;
  }

  return new URL('/', window.location.href).toString();
};

export const getChatAccessLoginUrl = (): string => {
  const loginUrl = new URL(buildChatApiUrl('/api/chat/login'), window.location.origin);
  loginUrl.searchParams.set('return_to', window.location.href);
  return loginUrl.toString();
};

export const getChatLogoutUrl = (): string => {
  if (rawLogoutUrl) {
    if (rawLogoutUrl === '/') return '/';
    return rawLogoutUrl;
  }

  if (apiBaseUrl) {
    return `${apiBaseUrl}/cdn-cgi/access/logout`;
  }

  return '/';
};

export const isExternalChatApiConfigured = (): boolean => Boolean(apiBaseUrl);

export const logoutFromAccessAndRedirect = async (): Promise<void> => {
  const logoutUrl = getChatLogoutUrl();
  const redirectUrl = getLogoutReturnTo();

  if (!isAccessLogoutPath(logoutUrl)) {
    window.location.assign(logoutUrl || redirectUrl);
    return;
  }

  try {
    await fetch(logoutUrl, {
      method: 'GET',
      credentials: 'include',
      mode: 'no-cors',
      cache: 'no-store'
    });
  } catch {
    // Proceed with redirect even if logout request fails due to browser/network conditions.
  }

  window.location.assign(redirectUrl);
};
