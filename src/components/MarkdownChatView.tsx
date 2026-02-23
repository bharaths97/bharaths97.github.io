import type { ReactNode } from 'react';

interface MarkdownChatViewProps {
  markdown: string;
}

const safeLink = (url: string): boolean => /^(https?:\/\/|mailto:)/i.test(url);
const safeImageSource = (url: string): boolean => /^(https?:\/\/|\/)/i.test(url);

const renderInline = (text: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const inlinePattern =
    /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*/g;
  let startIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > startIndex) {
      nodes.push(text.slice(startIndex, match.index));
    }

    const imageAlt = match[1];
    const imageUrl = match[2];
    const linkLabel = match[3];
    const linkUrl = match[4];
    const inlineCode = match[5];
    const boldTextAsterisk = match[6];
    const boldTextUnderscore = match[7];
    const italicText = match[8];

    if (imageUrl) {
      if (safeImageSource(imageUrl)) {
        nodes.push(
          <figure key={`${keyPrefix}-${match.index}`} className="my-2">
            <img
              src={imageUrl}
              alt={imageAlt || 'Project image'}
              className="max-h-[28rem] w-auto max-w-full rounded border border-green-matrix/30"
              loading="lazy"
            />
            {imageAlt && <figcaption className="mt-1 text-xs text-green-darker">{imageAlt}</figcaption>}
          </figure>
        );
      } else {
        nodes.push(match[0]);
      }
    } else {
      if (linkUrl && safeLink(linkUrl)) {
        nodes.push(
          <a
            key={`${keyPrefix}-${match.index}`}
            href={linkUrl}
            target={linkUrl.startsWith('mailto:') ? undefined : '_blank'}
            rel={linkUrl.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
            className="text-green-matrix underline decoration-green-matrix/50 underline-offset-2 hover:text-white"
          >
            {linkLabel}
          </a>
        );
      } else if (inlineCode) {
        nodes.push(
          <code
            key={`${keyPrefix}-${match.index}`}
            className="rounded border border-cyan-300/30 bg-cyan-300/10 px-1 py-0.5 text-cyan-200"
          >
            {inlineCode}
          </code>
        );
      } else if (boldTextAsterisk || boldTextUnderscore) {
        const boldText = boldTextAsterisk || boldTextUnderscore;
        nodes.push(
          <strong key={`${keyPrefix}-${match.index}`} className="font-semibold text-white">
            {boldText}
          </strong>
        );
      } else if (italicText) {
        nodes.push(
          <em key={`${keyPrefix}-${match.index}`} className="italic text-white/90">
            {italicText}
          </em>
        );
      } else {
        nodes.push(match[0]);
      }
    }

    startIndex = inlinePattern.lastIndex;
  }

  if (startIndex < text.length) {
    nodes.push(text.slice(startIndex));
  }

  return nodes;
};

const isUnorderedListLine = (line: string): boolean => /^\s*[-*]\s+/.test(line);
const isOrderedListLine = (line: string): boolean => /^\s*\d+\.\s+/.test(line);
const isTableDividerLine = (line: string): boolean => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim());
const looksLikeTableHeaderLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  if (!trimmed.startsWith('|')) return false;
  const cells = splitTableCells(trimmed);
  return cells.length >= 2;
};
const splitTableCells = (line: string): string[] => {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
};
const isSpecialBlockStarter = (line: string): boolean => {
  const trimmed = line.trim();
  return (
    trimmed === '' ||
    /^```/.test(trimmed) ||
    /^#{1,6}\s+/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    looksLikeTableHeaderLine(trimmed) ||
    isUnorderedListLine(trimmed) ||
    isOrderedListLine(trimmed)
  );
};

const renderHeadingWithIndicator = (
  level: 1 | 2 | 3,
  text: string,
  keyPrefix: string
): ReactNode => {
  if (level === 1) {
    return (
      <h1 key={keyPrefix} className="mb-3 mt-3 flex items-center gap-2 text-2xl text-cyan-300">
        <span className="border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[10px] tracking-wider text-cyan-200">
          SECTION
        </span>
        <span>{renderInline(text, keyPrefix)}</span>
      </h1>
    );
  }

  if (level === 2) {
    return (
      <h2 key={keyPrefix} className="mb-2 mt-3 flex items-center gap-2 text-xl text-amber-300">
        <span className="border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] tracking-wider text-amber-200">
          SUBSECTION
        </span>
        <span>{renderInline(text, keyPrefix)}</span>
      </h2>
    );
  }

  return (
    <h3 key={keyPrefix} className="mb-2 mt-2 flex items-center gap-2 text-lg text-red-300">
      <span className="border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[10px] tracking-wider text-red-200">
        DETAIL
      </span>
      <span>{renderInline(text, keyPrefix)}</span>
    </h3>
  );
};

export function MarkdownChatView({ markdown }: MarkdownChatViewProps) {
  const normalized = markdown.replace(/\r\n/g, '\n').trim();
  const lines = normalized ? normalized.split('\n') : [];
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length; ) {
    const currentLine = lines[index];
    const trimmed = currentLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const fenceInfo = trimmed.replace(/^```/, '').trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && /^```/.test(lines[index].trim())) {
        index += 1;
      }

      blocks.push(
        <div key={`code-${blocks.length}`} className="mb-4">
          {fenceInfo && <p className="mb-2 text-xs text-blue-300">{`> lang: ${fenceInfo}`}</p>}
          <pre className="overflow-x-auto rounded border border-blue-400/30 bg-black-deep p-3 text-sm text-white">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    const standaloneImageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (standaloneImageMatch) {
      const imageAlt = standaloneImageMatch[1];
      const imageUrl = standaloneImageMatch[2];

      if (safeImageSource(imageUrl)) {
        blocks.push(
          <figure key={`img-${blocks.length}`} className="mb-4">
            <img
              src={imageUrl}
              alt={imageAlt || 'Project image'}
              className="max-h-[32rem] w-auto max-w-full rounded border border-green-matrix/30"
              loading="lazy"
            />
            {imageAlt && <figcaption className="mt-1 text-xs text-green-darker">{imageAlt}</figcaption>}
          </figure>
        );
      } else {
        blocks.push(
          <p key={`img-fallback-${blocks.length}`} className="mb-3 text-white leading-relaxed whitespace-pre-wrap">
            {trimmed}
          </p>
        );
      }

      index += 1;
      continue;
    }

    if (
      looksLikeTableHeaderLine(trimmed) &&
      index + 1 < lines.length &&
      isTableDividerLine(lines[index + 1])
    ) {
      const headerCells = splitTableCells(trimmed);
      index += 2;

      const rowCells: string[][] = [];
      while (index < lines.length) {
        const rowTrimmed = lines[index].trim();
        if (!rowTrimmed || !rowTrimmed.startsWith('|')) break;
        rowCells.push(splitTableCells(rowTrimmed));
        index += 1;
      }

      const columnCount = Math.max(
        headerCells.length,
        ...rowCells.map((cells) => cells.length)
      );

      blocks.push(
        <div key={`table-${blocks.length}`} className="mb-5 overflow-x-auto rounded border border-cyan-400/30">
          <table className="min-w-full border-collapse text-left">
            <thead className="bg-cyan-400/10">
              <tr>
                {Array.from({ length: columnCount }).map((_, columnIndex) => (
                  <th
                    key={`th-${columnIndex}`}
                    className="border-b border-cyan-400/30 px-3 py-2 text-sm font-semibold text-cyan-200"
                  >
                    {renderInline(headerCells[columnIndex] || '', `table-h-${blocks.length}-${columnIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowCells.map((row, rowIndex) => (
                <tr key={`tr-${rowIndex}`} className="odd:bg-black-deep/40 even:bg-black-light/30">
                  {Array.from({ length: columnCount }).map((_, columnIndex) => (
                    <td key={`td-${rowIndex}-${columnIndex}`} className="border-t border-cyan-400/20 px-3 py-2 text-sm text-white">
                      {renderInline(row[columnIndex] || '', `table-r-${blocks.length}-${rowIndex}-${columnIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];

      const headingLevel = (level <= 1 ? 1 : level === 2 ? 2 : 3) as 1 | 2 | 3;
      blocks.push(renderHeadingWithIndicator(headingLevel, text, `h${headingLevel}-${blocks.length}`));

      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }

      blocks.push(
        <blockquote
          key={`quote-${blocks.length}`}
          className="mb-4 border-l-2 border-emerald-300/50 pl-3 text-white/95"
        >
          {quoteLines.map((line, quoteIndex) => (
            <p key={`quote-line-${quoteIndex}`} className="mb-1 last:mb-0">
              {renderInline(line, `quote-${blocks.length}-${quoteIndex}`)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (isUnorderedListLine(trimmed)) {
      const listItems: string[] = [];

      while (index < lines.length && isUnorderedListLine(lines[index].trim())) {
        listItems.push(lines[index].trim().replace(/^[-*]\s+/, ''));
        index += 1;
      }

      blocks.push(
        <ul key={`ul-${blocks.length}`} className="mb-4 list-disc pl-6 text-white marker:text-cyan-300">
          {listItems.map((item, listIndex) => (
            <li key={`ul-item-${listIndex}`} className="mb-1">
              {renderInline(item, `ul-${blocks.length}-${listIndex}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (isOrderedListLine(trimmed)) {
      const listItems: string[] = [];

      while (index < lines.length && isOrderedListLine(lines[index].trim())) {
        listItems.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }

      blocks.push(
        <ol key={`ol-${blocks.length}`} className="mb-4 list-decimal pl-6 text-white marker:text-amber-300">
          {listItems.map((item, listIndex) => (
            <li key={`ol-item-${listIndex}`} className="mb-1">
              {renderInline(item, `ol-${blocks.length}-${listIndex}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    index += 1;

    while (index < lines.length && !isSpecialBlockStarter(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="mb-3 text-white leading-relaxed whitespace-pre-wrap">
        {renderInline(paragraphLines.join(' '), `p-${blocks.length}`)}
      </p>
    );
  }

  if (blocks.length === 0) {
    return <p className="text-white">No project details provided yet.</p>;
  }

  return <div>{blocks}</div>;
}
