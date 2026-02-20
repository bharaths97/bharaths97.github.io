import { useEffect, useState } from 'react';
import { ChatPage } from './pages/ChatPage';
import { PortfolioPage } from './pages/PortfolioPage';

type AppRoute = 'portfolio' | 'chat';

const normalizePathname = (pathname: string): string => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

const getRouteFromPathname = (pathname: string): AppRoute => {
  const normalized = normalizePathname(pathname.toLowerCase());
  if (normalized === '/chat' || normalized.endsWith('/chat')) {
    return 'chat';
  }

  return 'portfolio';
};

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromPathname(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRouteFromPathname(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (route === 'chat') {
    return <ChatPage />;
  }

  return <PortfolioPage />;
}
