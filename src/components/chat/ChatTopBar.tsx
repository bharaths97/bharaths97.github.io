import { LogOut, Terminal } from 'lucide-react';

interface ChatTopBarProps {
  username: string;
  onLogout: () => void;
}

export function ChatTopBar({ username, onLogout }: ChatTopBarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-black-deep/90 backdrop-blur-sm border-b border-green-matrix/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <Terminal className="w-6 h-6 text-green-matrix" />
            <span className="text-green-matrix font-mono tracking-wider"> the_manuscript.init</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-green-dark text-sm font-mono border border-green-matrix/25 px-2 py-1 bg-black-light/50">
              {username}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-green-matrix/40 text-green-dark hover:text-black hover:bg-green-matrix transition-all duration-300 font-mono text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
