import { useEffect, useState } from 'react';
import { ChatPage } from './pages/ChatPage';
import { PortfolioPage } from './pages/PortfolioPage';

type AppRoute = 'portfolio' | 'chat';

const normalizePathname = (pathname: string): string => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

const normalizeHashRoute = (hash: string): string => {
  const route = hash.replace(/^#/, '').trim();
  if (!route) return '/';

  if (route.startsWith('/')) return normalizePathname(route);
  return normalizePathname(`/${route}`);
};

const getRouteFromLocation = (locationValue: Pick<Location, 'pathname' | 'hash'>): AppRoute => {
  const normalizedHashRoute = normalizeHashRoute(locationValue.hash);
  if (normalizedHashRoute === '/chat') {
    return 'chat';
  }

  // Supports direct /chat where hosting layer handles SPA fallback.
  const pathname = locationValue.pathname;
  const normalized = normalizePathname(pathname.toLowerCase());
  if (normalized === '/chat' || normalized.endsWith('/chat')) {
    return 'chat';
  }

  return 'portfolio';
};

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation(window.location));

  useEffect(() => {
    const syncRoute = () => {
      setRoute(getRouteFromLocation(window.location));
    };

    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  if (route === 'chat') {
    return <ChatPage />;
  }

  return <PortfolioPage />;
}
