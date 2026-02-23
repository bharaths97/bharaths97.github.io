import { useEffect, useState } from 'react';
import { Terminal, Menu, X, Github, Linkedin, Mail, ChevronRight } from 'lucide-react';
import { PortfolioSection } from '../components/PortfolioSection';
import portfolioContent from '../content/portfolio.json';

type SocialIcon = 'github' | 'linkedin' | 'mail';

interface SocialLink {
  icon: SocialIcon;
  url: string;
}

interface NavItem {
  id: string;
  label: string;
  sublabels?: string | string[] | Array<string | { label: string; id?: string }>;
}

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

interface SectionData {
  id: string;
  label: string;
  tag: string;
  title: string;
  subtitle: string;
  items?: SectionItem[];
  subgroups?: SectionSubgroup[];
}

interface TerminalBlock {
  command: string;
  output: string;
}

interface ContactFormContent {
  terminalLabel: string;
  successTitle: string;
  successMessage: string;
  labels: {
    name: string;
    email: string;
    subject: string;
    message: string;
  };
  placeholders: {
    name: string;
    email: string;
    subject: string;
    message: string;
  };
  submitDefault: string;
  submitSending: string;
  errorMessage: string;
  statusLabel: string;
  readyLabel: string;
  connectionLabel: string;
  connectionValue: string;
  encryptionLabel: string;
  encryptionValue: string;
}

interface PortfolioContent {
  profile: {
    name: string;
    email: string;
    github: string;
    linkedin: string;
  };
  navigation: NavItem[];
  home: {
    terminalTyping: string;
    badge: string;
    headline: [string, string];
    primaryLine: string;
    secondaryLine: string;
    terminalBlocks: TerminalBlock[];
    primaryButton: string;
    secondaryButton: string;
    tertiaryButton?: string;
    tertiaryButtonUrl?: string;
    socialLinks: SocialLink[];
  };
  sections: SectionData[];
  contact: {
    tag: string;
    title: string;
    subtitle: string;
    form: ContactFormContent;
  };
  footer: {
    copyright: string;
    tagline: string;
  };
}

const content = portfolioContent as PortfolioContent;

const iconMap = {
  github: Github,
  linkedin: Linkedin,
  mail: Mail
};

type ParsedSubNav = {
  label: string;
  targetId: string;
};

const subgroupSlug = (value: string): string => value.replace(/^\/+/, '').replace(/\s+/g, '-').toLowerCase();

export function PortfolioPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [typedText, setTypedText] = useState('');
  const fullText = content.home.terminalTyping;
  const derivedSubgroupIds = content.sections.flatMap((section) => {
    const explicit = (section.subgroups || []).map((group) => group.id);
    const fromItems = (section.items || [])
      .map((item) => item.sublabel?.trim())
      .filter((value): value is string => Boolean(value))
      .map((value) => `${section.id}-${subgroupSlug(value)}`);

    return [...explicit, ...fromItems];
  });

  const knownTargets = new Set<string>([
    'home',
    'contact',
    ...content.sections.map((section) => section.id),
    ...derivedSubgroupIds,
    ...content.navigation.map((item) => item.id)
  ]);

  useEffect(() => {
    if (typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1));
      }, 90);
      return () => clearTimeout(timeout);
    }
  }, [typedText, fullText]);

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);

    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navigateToProjectsArchive = () => {
    setMobileMenuOpen(false);
    window.location.hash = '/projects';
  };

  const normalizeTarget = (raw: string): string => raw.trim().replace(/^\/+/, '');

  const parseSubLabels = (item: NavItem): ParsedSubNav[] => {
    if (!item.sublabels) return [];

    const rawList =
      typeof item.sublabels === 'string'
        ? item.sublabels.split(',').map((x) => x.trim()).filter(Boolean)
        : item.sublabels;

    const list = rawList.map((entry) => {
      if (typeof entry === 'string') {
        const normalized = normalizeTarget(entry);
        const sectionScopedTarget = `${item.id}-${subgroupSlug(entry)}`;
        const targetId = knownTargets.has(normalized)
          ? normalized
          : knownTargets.has(sectionScopedTarget)
            ? sectionScopedTarget
            : item.id;
        return { label: entry.trim(), targetId };
      }

      const label = entry.label.trim();
      const normalized = entry.id ? normalizeTarget(entry.id) : normalizeTarget(entry.label);
      const sectionScopedTarget = `${item.id}-${subgroupSlug(entry.label)}`;
      const targetId = knownTargets.has(normalized)
        ? normalized
        : knownTargets.has(sectionScopedTarget)
          ? sectionScopedTarget
          : item.id;
      return { label, targetId };
    });

    return list;
  };

  const getPrimaryNavTarget = (item: NavItem, subNav: ParsedSubNav[]): string => {
    if (knownTargets.has(item.id)) return item.id;
    if (subNav[0]?.targetId) return subNav[0].targetId;
    return 'home';
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-50 opacity-10">
        <div
          className="h-full w-full bg-gradient-to-b from-transparent via-[#00ff41] to-transparent animate-[scan_8s_linear_infinite]"
          style={{
            backgroundSize: '100% 4px',
            animation: 'scan 8s linear infinite'
          }}
        />
      </div>

      <nav className="fixed top-0 left-0 right-0 z-40 bg-black-deep/90 backdrop-blur-sm border-b border-green-matrix/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToSection('home')}>
              <Terminal className="w-6 h-6 text-green-matrix" />
              <span className="text-green-matrix font-mono tracking-wider">
                {typedText}
                <span className="animate-[terminal-cursor_1s_infinite]">_</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {content.navigation.map((item) => {
                const subNav = parseSubLabels(item);
                const primaryTarget = getPrimaryNavTarget(item, subNav);

                if (subNav.length === 0) {
                  return (
                    <button
                      key={item.id}
                      onClick={item.id === 'projects' ? navigateToProjectsArchive : () => scrollToSection(primaryTarget)}
                      className="text-green-dark hover:text-green-matrix transition-colors relative group"
                    >
                      <span className="relative">
                        {`> ${item.label}`}
                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-matrix group-hover:w-full transition-all duration-300"></span>
                      </span>
                    </button>
                  );
                }

                return (
                  <div key={item.id} className="relative group">
                    <button
                      onClick={() => scrollToSection(primaryTarget)}
                      className="text-green-dark hover:text-green-matrix transition-colors relative"
                    >
                      <span className="relative">
                        {`> ${item.label}`}
                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-matrix group-hover:w-full transition-all duration-300"></span>
                      </span>
                    </button>

                    <div className="absolute left-0 top-full pt-2 min-w-52 z-50 opacity-0 invisible translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0">
                      <div className="border border-green-matrix/30 bg-black-light/95 backdrop-blur-sm">
                        {subNav.map((sub) => (
                          <button
                            key={`${item.id}-${sub.label}`}
                            onClick={() => scrollToSection(sub.targetId)}
                            className="block w-full text-left px-3 py-2 text-sm text-green-dark hover:text-green-matrix hover:bg-green-matrix/10 transition-colors"
                          >
                            {`> ${sub.label}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              className="md:hidden text-green-matrix"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-black-light border-t border-green-matrix/30">
            <div className="px-4 py-4 space-y-3">
              {content.navigation.map((item) => {
                const subNav = parseSubLabels(item);
                const primaryTarget = getPrimaryNavTarget(item, subNav);

                return (
                  <div key={item.id} className="space-y-2">
                    <button
                      onClick={item.id === 'projects' ? navigateToProjectsArchive : () => scrollToSection(primaryTarget)}
                      className="block w-full text-left text-green-dark hover:text-green-matrix transition-colors"
                    >
                      {`> ${item.label}`}
                    </button>
                    {subNav.length > 0 && (
                      <div className="pl-4 space-y-1 border-l border-green-matrix/20">
                        {subNav.map((sub) => (
                          <button
                            key={`${item.id}-mobile-${sub.label}`}
                            onClick={() => scrollToSection(sub.targetId)}
                            className="block w-full text-left text-xs text-green-darker hover:text-green-matrix transition-colors"
                          >
                            {`- ${sub.label}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <section id="home" className="min-h-screen flex items-center justify-center pt-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-8 inline-block">
            <div className="border border-green-matrix/50 px-4 py-2 inline-block bg-green-matrix/5">
              <span className="text-green-matrix tracking-widest text-sm">{content.home.badge}</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl mb-6 tracking-tight">
            <span className="inline-block hover:animate-[glitch_0.3s_infinite]">{content.home.headline[0]}</span>
            <br />
            <span className="inline-block hover:animate-[glitch_0.3s_infinite] delay-75">{content.home.headline[1]}</span>
          </h1>

          <div className="text-green-dark text-lg md:text-xl mb-8 max-w-3xl mx-auto space-y-2">
            <p className="font-mono">{content.home.primaryLine}</p>
            <p className="font-mono text-sm opacity-80">{content.home.secondaryLine}</p>
          </div>

          <div className="mx-auto mb-8 max-w-3xl rounded border border-green-matrix/30 bg-black-light/40 p-5 text-left">
            {content.home.terminalBlocks.map((block) => (
              <div key={block.command} className="mb-3 last:mb-0">
                <p className="font-mono text-green-matrix">{`> ${block.command}`}</p>
                <p className="font-mono text-green-dark text-sm whitespace-pre-line">{block.output}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => scrollToSection(content.sections[0]?.id ?? 'education')}
              className="group px-8 py-3 border border-green-matrix text-green-matrix hover:bg-green-matrix hover:text-black transition-all duration-300 flex items-center gap-2"
            >
              <span>{content.home.primaryButton}</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="px-8 py-3 bg-green-matrix/10 border border-green-matrix/30 text-green-dark hover:border-green-matrix hover:text-green-matrix transition-all duration-300"
            >
              {content.home.secondaryButton}
            </button>
            {content.home.tertiaryButton && content.home.tertiaryButtonUrl && (
              <a
                href={content.home.tertiaryButtonUrl}
                download
                className="px-8 py-3 border border-green-matrix/40 text-green-matrix bg-black-light/50 hover:bg-green-matrix hover:text-black transition-all duration-300 font-medium"
              >
                {content.home.tertiaryButton}
              </a>
            )}
            <button
              onClick={navigateToProjectsArchive}
              className="px-8 py-3 border border-green-matrix/40 text-green-matrix bg-black-light/50 hover:bg-green-matrix hover:text-black transition-all duration-300"
            >
              Open Project Archive
            </button>
          </div>

          <div className="mt-10 flex gap-6 justify-center">
            {content.home.socialLinks.map((social) => {
              const Icon = iconMap[social.icon];
              return (
                <a
                  key={social.icon}
                  href={social.url}
                  target={social.icon === 'mail' ? undefined : '_blank'}
                  rel={social.icon === 'mail' ? undefined : 'noopener noreferrer'}
                  className="text-green-dark hover:text-green-matrix transition-colors"
                >
                  <Icon className="w-6 h-6" />
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {content.sections.map((section) => (
        <PortfolioSection
          key={section.id}
          id={section.id}
          tag={section.tag}
          title={section.title}
          subtitle={section.subtitle}
          items={section.items}
          subgroups={section.subgroups}
        />
      ))}

      <section id="contact" className="py-20 px-4 relative">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12 text-center">
            <div className="inline-block mb-4">
              <span className="text-green-matrix text-sm tracking-widest border border-green-matrix/50 px-3 py-1 inline-block">
                {content.contact.tag}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl mb-4">{content.contact.title}</h2>
            <p className="text-green-dark">{`// ${content.contact.subtitle}`}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a
              href={content.profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="relative border border-green-matrix/30 bg-black-light p-6 text-green-dark hover:text-green-matrix hover:bg-black-light/80 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <Linkedin className="w-6 h-6 text-green-matrix" />
                <h3 className="text-xl text-green-matrix">LinkedIn</h3>
              </div>
              <p className="font-mono break-all text-base">{content.profile.linkedin}</p>
              <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-green-matrix/40" />
            </a>

            <a
              href={content.profile.github}
              target="_blank"
              rel="noopener noreferrer"
              className="relative border border-green-matrix/30 bg-black-light p-6 text-green-dark hover:text-green-matrix hover:bg-black-light/80 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <Github className="w-6 h-6 text-green-matrix" />
                <h3 className="text-xl text-green-matrix">GitHub</h3>
              </div>
              <p className="font-mono break-all text-base">{content.profile.github}</p>
              <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-green-matrix/40" />
            </a>

            <a
              href={`mailto:${content.profile.email}`}
              className="relative border border-green-matrix/30 bg-black-light p-6 text-green-dark hover:text-green-matrix hover:bg-black-light/80 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <Mail className="w-6 h-6 text-green-matrix" />
                <h3 className="text-xl text-green-matrix">Email</h3>
              </div>
              <p className="font-mono break-all text-base">{content.profile.email}</p>
              <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-green-matrix/40" />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-green-matrix/30 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-green-dark text-sm font-mono">{content.footer.copyright}</p>
          <p className="text-green-darker text-xs mt-2 font-mono">{content.footer.tagline}</p>
        </div>
      </footer>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
}
