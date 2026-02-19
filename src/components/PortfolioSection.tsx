import { useState } from 'react';
import { motion } from 'motion/react';

interface SectionLink {
  label: string;
  url: string;
}

interface SectionItem {
  id: string;
  title: string;
  meta?: string;
  sublabel?: string;
  summary: string;
  bullets?: string[];
  links?: SectionLink[];
}

interface SectionSubgroup {
  id: string;
  label?: string;
  title: string;
  subtitle?: string;
  items: SectionItem[];
}

interface PortfolioSectionProps {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  items?: SectionItem[];
  subgroups?: SectionSubgroup[];
}

export function PortfolioSection({ id, tag, title, subtitle, items = [], subgroups = [] }: PortfolioSectionProps) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const getItemLabel = (): string => {
    const sectionId = id.toLowerCase();
    const sectionTitle = title.toLowerCase();

    if (sectionId.includes('education') || sectionTitle.includes('education')) return 'Patch';
    if (
      sectionId.includes('experience') ||
      sectionId.includes('work') ||
      sectionTitle.includes('experience')
    ) {
      return 'Build';
    }
    if (
      sectionId.includes('project') ||
      sectionId.includes('lab') ||
      sectionId.includes('photo') ||
      sectionTitle.includes('project')
    ) {
      return 'Lab';
    }

    return 'Patch';
  };

  const itemLabel = getItemLabel();
  // If explicit subgroups are provided, use them.
  // Otherwise, build subgroup blocks from item.sublabel values.
  const derivedSubgroups: SectionSubgroup[] =
    subgroups.length > 0
      ? subgroups
      : (() => {
          const bucket = new Map<string, SectionItem[]>();
          const order: string[] = [];

          for (const item of items) {
            const key = item.sublabel?.trim() || '';
            if (!key) continue;
            if (!bucket.has(key)) {
              bucket.set(key, []);
              order.push(key);
            }
            bucket.get(key)!.push(item);
          }

          return order.map((key) => ({
            id: `${id}-${key.replace(/^\/+/, '').replace(/\s+/g, '-').toLowerCase()}`,
            title: key,
            items: bucket.get(key) || []
          }));
        })();

  const hasSubgroups = derivedSubgroups.length > 0;
  const totalArtifacts = hasSubgroups
    ? derivedSubgroups.reduce((count, group) => count + group.items.length, 0)
    : items.length;

  const isExpanded = (itemId: string): boolean => expandedItems[itemId] ?? false;
  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const renderItemCard = (item: SectionItem, index: number, total: number) => (
    <motion.article
      key={item.id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      className="relative border border-green-matrix/30 bg-black-light p-6 text-base md:text-lg"
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="text-2xl text-green-matrix">{item.title}</h3>
        <span className="text-green-darker text-base font-mono">
          [{itemLabel} : {String(total - index).padStart(2, '0')}]
        </span>
      </div>

      {item.meta && <p className="text-lg text-green-dark mb-3 font-mono">{item.meta}</p>}

      <p className="text-lg text-green-dark leading-relaxed mb-3 font-medium">{item.summary}</p>

      {isExpanded(item.id) && item.bullets && item.bullets.length > 0 && (
        <ul className="list-disc pl-5 text-lg text-green-dark leading-relaxed space-y-2 mb-4 font-medium marker:text-green-dark">
          {item.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      )}

      {item.links && item.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.links.map((link) => (
            <a
              key={`${item.id}-${link.label}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-mono border border-green-matrix/40 px-3 py-1 text-green-matrix hover:bg-green-matrix hover:text-black transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => toggleExpanded(item.id)}
          className="text-sm md:text-base font-mono border border-green-matrix/35 px-2 py-1 text-green-dark hover:text-green-matrix hover:bg-green-matrix/10 transition-colors"
          aria-expanded={isExpanded(item.id)}
        >
          {isExpanded(item.id) ? 'Collapse [-]' : 'Expand [+]'}
        </button>
      </div>

      <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-green-matrix/40" />
    </motion.article>
  );

  return (
    <section id={id} className="py-20 px-4 relative">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <div className="inline-block mb-4">
            <span className="text-green-matrix text-sm tracking-widest border border-green-matrix/50 px-3 py-1 inline-block">
              {tag}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl mb-3">{title}</h2>
          <div className="inline-block border border-green-matrix/30 px-4 py-2 bg-black-light">
            <span className="text-green-dark font-mono text-sm">
              {hasSubgroups
                ? `> ${derivedSubgroups.length} SUB-DIRECTOR${derivedSubgroups.length !== 1 ? 'IES' : 'Y'}, ${totalArtifacts} ARTIFACT${totalArtifacts !== 1 ? 'S' : ''} INDEXED_`
                : `> ${totalArtifacts} ARTIFACT${totalArtifacts !== 1 ? 'S' : ''} INDEXED_`}
            </span>
          </div>
        </div>

        {!hasSubgroups && (
          <div className="grid grid-cols-1 gap-6">
            {items.map((item, index) => renderItemCard(item, index, items.length))}
          </div>
        )}

        {hasSubgroups && (
          <div className="space-y-8">
            {derivedSubgroups.map((group) => (
              <div key={group.id} id={group.id} className="rounded border border-green-matrix/20 bg-black-light/30 p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-green-matrix/20 pb-3">
                  <div>
                    <h3 className="text-2xl text-green-matrix">{group.title}</h3>
                    {group.subtitle && <p className="text-base text-green-dark mt-1">{group.subtitle}</p>}
                  </div>
                  <span className="text-sm font-mono text-green-darker">
                    {`> ${group.items.length} ARTIFACT${group.items.length !== 1 ? 'S' : ''}`}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {group.items.map((item, index) => renderItemCard(item, index, group.items.length))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
