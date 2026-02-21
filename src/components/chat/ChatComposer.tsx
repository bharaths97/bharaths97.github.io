import { useMemo, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Lock, Send } from 'lucide-react';
import type { ChatMemoryMode, ChatMemoryModeOption, ChatUseCaseOption } from '../../types/chat';

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  useCases: ChatUseCaseOption[];
  selectedUseCaseId: string | null;
  onUseCaseChange: (useCaseId: string) => void;
  memoryModes: ChatMemoryModeOption[];
  selectedMemoryMode: ChatMemoryMode | null;
  onMemoryModeChange: (memoryMode: ChatMemoryMode) => void;
  useCaseLocked: boolean;
  disabled?: boolean;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  useCases,
  selectedUseCaseId,
  onUseCaseChange,
  memoryModes,
  selectedMemoryMode,
  onMemoryModeChange,
  useCaseLocked,
  disabled = false
}: ChatComposerProps) {
  const [isUseCaseMenuOpen, setIsUseCaseMenuOpen] = useState(false);
  const [isMemoryModeMenuOpen, setIsMemoryModeMenuOpen] = useState(false);

  const selectedUseCase = useMemo(
    () => useCases.find((useCase) => useCase.id === selectedUseCaseId) || null,
    [selectedUseCaseId, useCases]
  );
  const selectedMode = useMemo(
    () => memoryModes.find((mode) => mode.id === selectedMemoryMode) || null,
    [memoryModes, selectedMemoryMode]
  );
  const defaultModeLabel = useMemo(
    () => memoryModes.find((mode) => mode.id === 'classic')?.display_name || 'Speak Small',
    [memoryModes]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <section className="rounded border border-green-matrix/30 bg-black-light/40 p-4">
      <label htmlFor="chat-input" className="font-mono text-green-matrix text-sm block mb-2">
        {'> send.exploit -payload message.txt'}
      </label>

      <div className="flex flex-col gap-3">
        <textarea
          id="chat-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="Craft your payload..."
          className="w-full resize-none bg-black-deep border border-green-matrix/30 text-green-matrix px-4 py-3 focus:border-green-matrix focus:outline-none focus:ring-1 focus:ring-green-matrix transition-all duration-300 font-mono"
        />

        <div className="flex justify-end">
          <div className="flex items-center gap-2">
            {useCases.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  disabled={useCaseLocked}
                  onClick={() => setIsUseCaseMenuOpen((value) => !value)}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-green-matrix/40 text-green-dark hover:text-black hover:bg-green-matrix transition-all duration-300 font-mono text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {selectedUseCase?.display_name || 'Select profile'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${isUseCaseMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUseCaseMenuOpen && !useCaseLocked && (
                  <div className="absolute bottom-full right-0 mb-2 w-52 border border-green-matrix/35 bg-black-deep/95 backdrop-blur-sm">
                    {useCases.map((useCase) => (
                      <button
                        key={useCase.id}
                        type="button"
                        onClick={() => {
                          onUseCaseChange(useCase.id);
                          setIsUseCaseMenuOpen(false);
                        }}
                        className={`block w-full text-left px-3 py-2 font-mono text-xs hover:bg-green-matrix/15 ${
                          useCase.id === selectedUseCaseId ? 'text-green-matrix' : 'text-green-dark'
                        }`}
                      >
                        {useCase.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {memoryModes.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  disabled={useCaseLocked}
                  onClick={() => setIsMemoryModeMenuOpen((value) => !value)}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-green-matrix/40 text-green-dark hover:text-black hover:bg-green-matrix transition-all duration-300 font-mono text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {selectedMode?.display_name || 'Select mode'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${isMemoryModeMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMemoryModeMenuOpen && !useCaseLocked && (
                  <div className="absolute bottom-full right-0 mb-2 w-56 border border-green-matrix/35 bg-black-deep/95 backdrop-blur-sm">
                    {memoryModes.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          onMemoryModeChange(mode.id);
                          setIsMemoryModeMenuOpen(false);
                        }}
                        className={`block w-full text-left px-3 py-2 font-mono text-xs hover:bg-green-matrix/15 ${
                          mode.id === selectedMemoryMode ? 'text-green-matrix' : 'text-green-dark'
                        }`}
                      >
                        {mode.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {useCaseLocked && selectedUseCase && (
              <div className="relative group">
                <span className="inline-flex items-center justify-center p-1 text-green-dark/80">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap border border-green-matrix/35 bg-black-deep/95 px-2 py-1 font-mono text-[11px] text-green-dark opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  {`locked: ${selectedUseCase.display_name} | ${selectedMode?.display_name || defaultModeLabel}`}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onSend}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-4 py-2 border border-green-matrix text-green-matrix hover:bg-green-matrix hover:text-black transition-all duration-300 font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Exploit
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
