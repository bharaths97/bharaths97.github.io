export interface ProjectDocument {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  order: number;
  content: string;
  sourcePath: string;
}

interface Frontmatter {
  title?: string;
  summary?: string;
  tags?: string;
  order?: string;
}

const markdownModules = import.meta.glob('../content/projects/*.md', {
  eager: true,
  import: 'default',
  query: '?raw'
}) as Record<string, string>;

const FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

const slugToTitle = (slug: string): string =>
  slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();

const parseFrontmatter = (raw: string): { frontmatter: Frontmatter; body: string } => {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(FRONTMATTER_PATTERN);

  if (!match) {
    return { frontmatter: {}, body: normalized.trim() };
  }

  const frontmatterLines = match[1].split('\n');
  const frontmatter: Frontmatter = {};

  for (const line of frontmatterLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim().toLowerCase();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['\"]|['\"]$/g, '');

    if (key === 'title' || key === 'summary' || key === 'tags' || key === 'order') {
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter,
    body: normalized.slice(match[0].length).trim()
  };
};

const parseTags = (rawTags: string | undefined): string[] => {
  if (!rawTags) return [];

  return rawTags
    .replace(/^[\[]|[\]]$/g, '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const extractSummary = (markdown: string): string => {
  const lines = markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const paragraphLine = lines.find((line) => {
    return !/^#{1,6}\s/.test(line) && !/^(?:[-*]|\d+\.)\s/.test(line) && !/^>\s?/.test(line) && !/^```/.test(line);
  });

  return paragraphLine || 'Detailed write-up available in the project page.';
};

const normalizeOrder = (value: string | undefined): number => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

export const projectDocuments: ProjectDocument[] = Object.entries(markdownModules)
  .map(([sourcePath, rawContent]) => {
    const fileName = sourcePath.split('/').pop() || '';
    const slug = fileName.replace(/\.md$/i, '');
    const { frontmatter, body } = parseFrontmatter(rawContent);

    return {
      slug,
      title: frontmatter.title?.trim() || slugToTitle(slug),
      summary: frontmatter.summary?.trim() || extractSummary(body),
      tags: parseTags(frontmatter.tags),
      order: normalizeOrder(frontmatter.order),
      content: body,
      sourcePath
    };
  })
  .sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });

export const getProjectBySlug = (slug: string): ProjectDocument | undefined => {
  return projectDocuments.find((project) => project.slug === slug);
};
