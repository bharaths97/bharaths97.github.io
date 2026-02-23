export const PORTFOLIO_ROUTE = '/';
export const PROJECTS_ROUTE = '/projects';

export const buildProjectDetailRoute = (slug: string): string => `${PROJECTS_ROUTE}/${encodeURIComponent(slug)}`;

export const toHashRoute = (route: string): string => `#${route}`;

export const getPortfolioHashRoute = (): string => toHashRoute(PORTFOLIO_ROUTE);
export const getProjectsHashRoute = (): string => toHashRoute(PROJECTS_ROUTE);
export const getProjectDetailHashRoute = (slug: string): string => toHashRoute(buildProjectDetailRoute(slug));
