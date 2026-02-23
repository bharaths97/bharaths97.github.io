import { useEffect, useState } from 'react';
import { PortfolioPage } from './pages/PortfolioPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { PORTFOLIO_ROUTE, PROJECTS_ROUTE } from './lib/projectRoutes';

type AppRoute =
  | { kind: 'portfolio' }
  | { kind: 'projects' }
  | { kind: 'project-detail'; slug: string };

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

const parseRoute = (route: string): AppRoute => {
  const normalized = normalizePathname(route);

  if (normalized === PROJECTS_ROUTE) {
    return { kind: 'projects' };
  }

  const projectDetailMatch = normalized.match(/^\/projects\/([^/]+)$/);
  if (projectDetailMatch) {
    try {
      return { kind: 'project-detail', slug: decodeURIComponent(projectDetailMatch[1]) };
    } catch {
      return { kind: 'portfolio' };
    }
  }

  return { kind: 'portfolio' };
};

const parsePathnameRoute = (pathname: string): AppRoute => {
  const normalized = normalizePathname(pathname);
  const segments = normalized.split('/').filter(Boolean);

  const projectsIndex = segments.findIndex((segment) => segment.toLowerCase() === 'projects');
  if (projectsIndex < 0) {
    return { kind: 'portfolio' };
  }

  if (projectsIndex === segments.length - 1) {
    return { kind: 'projects' };
  }

  if (projectsIndex === segments.length - 2) {
    try {
      return { kind: 'project-detail', slug: decodeURIComponent(segments[segments.length - 1]) };
    } catch {
      return { kind: 'portfolio' };
    }
  }

  return { kind: 'portfolio' };
};

const getRouteFromLocation = (locationValue: Pick<Location, 'pathname' | 'hash'>): AppRoute => {
  const hashRoute = normalizeHashRoute(locationValue.hash);

  if (hashRoute !== PORTFOLIO_ROUTE) {
    return parseRoute(hashRoute);
  }

  return parsePathnameRoute(locationValue.pathname);
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

  if (route.kind === 'projects') {
    return <ProjectsPage />;
  }

  if (route.kind === 'project-detail') {
    return <ProjectDetailPage slug={route.slug} />;
  }

  return <PortfolioPage />;
}
