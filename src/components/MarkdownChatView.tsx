import type { ReactNode } from 'react';

interface MarkdownChatViewProps {
  markdown: string;
}

const safeLink = (url: string): boolean => /^(https?:\/\/|mailto:)/i.test(url);

const renderInline = (text: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let startIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > startIndex) {
      nodes.push(text.slice(startIndex, match.index));
    }

    const label = match[1];
    const url = match[2];

    if (safeLink(url)) {
      nodes.push(
        <a
          key={`${keyPrefix}-${match.index}`}
          href={url}
          target={url.startsWith('mailto:') ? undefined : '_blank'}
          rel={url.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
          className="text-green-matrix underline decoration-green-matrix/50 underline-offset-2 hover:text-white"
        >
          {label}
        </a>
      );
    } else {
      nodes.push(match[0]);
    }

    startIndex = linkPattern.lastIndex;
  }

  if (startIndex < text.length) {
    nodes.push(text.slice(startIndex));
  }

  return nodes;
};

const isUnorderedListLine = (line: string): boolean => /^\s*[-*]\s+/.test(line);
const isOrderedListLine = (line: string): boolean => /^\s*\d+\.\s+/.test(line);
const isSpecialBlockStarter = (line: string): boolean => {
  const trimmed = line.trim();
  return (
    trimmed === '' ||
    /^```/.test(trimmed) ||
    /^#{1,6}\s+/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    isUnorderedListLine(trimmed) ||
    isOrderedListLine(trimmed)
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
          {fenceInfo && <p className="mb-2 text-xs text-green-darker">{`> lang: ${fenceInfo}`}</p>}
          <pre className="overflow-x-auto rounded border border-green-matrix/25 bg-black-deep p-3 text-sm text-green-dark">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];

      if (level === 1) {
        blocks.push(
          <h1 key={`h1-${blocks.length}`} className="mb-3 mt-2 text-2xl text-green-matrix">
            {renderInline(text, `h1-${blocks.length}`)}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={`h2-${blocks.length}`} className="mb-2 mt-2 text-xl text-green-matrix">
            {renderInline(text, `h2-${blocks.length}`)}
          </h2>
        );
      } else {
        blocks.push(
          <h3 key={`h3-${blocks.length}`} className="mb-2 mt-2 text-lg text-green-matrix">
            {renderInline(text, `h3-${blocks.length}`)}
          </h3>
        );
      }

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
          className="mb-4 border-l-2 border-green-matrix/40 pl-3 text-green-dark/90"
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
        <ul key={`ul-${blocks.length}`} className="mb-4 list-disc pl-6 text-green-dark marker:text-green-matrix">
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
        <ol key={`ol-${blocks.length}`} className="mb-4 list-decimal pl-6 text-green-dark marker:text-green-matrix">
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
      <p key={`p-${blocks.length}`} className="mb-3 text-green-dark leading-relaxed whitespace-pre-wrap">
        {renderInline(paragraphLines.join(' '), `p-${blocks.length}`)}
      </p>
    );
  }

  if (blocks.length === 0) {
    return <p className="text-green-dark">No project details provided yet.</p>;
  }

  return <div>{blocks}</div>;
}
