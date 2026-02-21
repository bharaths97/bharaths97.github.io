import { Terminal } from 'lucide-react';

export interface TerminalTopBarItem {
  id: string;
  label: string;
  onClick?: () => void;
}

interface TerminalTopBarProps {
  leftLabel: string;
  onLeftClick?: () => void;
  items: TerminalTopBarItem[];
}

const ItemLabel = ({ label }: { label: string }) => (
  <span className="relative">
    {`> ${label}`}
    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-matrix transition-all duration-300 group-hover:w-full" />
  </span>
);

export function TerminalTopBar({ leftLabel, onLeftClick, items }: TerminalTopBarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-black-deep/90 backdrop-blur-sm border-b border-green-matrix/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">
          <button
            type="button"
            onClick={onLeftClick}
            className={`flex items-center gap-2 ${onLeftClick ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <Terminal className="w-6 h-6 text-green-matrix" />
            <span className="text-green-matrix font-mono tracking-wider">{leftLabel}</span>
          </button>

          <div className="flex items-center gap-4 md:gap-8">
            {items.map((item) =>
              item.onClick ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="text-green-dark hover:text-green-matrix transition-colors relative group whitespace-nowrap"
                >
                  <ItemLabel label={item.label} />
                </button>
              ) : (
                <span key={item.id} className="text-green-dark whitespace-nowrap">
                  {`> ${item.label}`}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
