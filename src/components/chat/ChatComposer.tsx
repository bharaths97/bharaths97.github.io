import type { KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export function ChatComposer({ value, onChange, onSend, disabled = false }: ChatComposerProps) {
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
    </section>
  );
}
