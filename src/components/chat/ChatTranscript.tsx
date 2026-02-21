import { useEffect, useMemo, useState } from 'react';
import coloredBootHtml from '../../assets/chat/colored_boot.html?raw';
import type { ChatMessage } from '../../types/chat';

interface ChatTranscriptProps {
  messages: ChatMessage[];
  isThinking: boolean;
  username: string;
  errorMessage?: string | null;
}

export function ChatTranscript({ messages, isThinking, username, errorMessage = null }: ChatTranscriptProps) {
  const promptUsername = username.trim() || 'authorized_user';
  const [showBootArt, setShowBootArt] = useState(true);
  const [isBootArtFading, setIsBootArtFading] = useState(false);
  const [showReadyLine, setShowReadyLine] = useState(false);

  const bootAsciiMarkup = useMemo(() => {
    const match = coloredBootHtml.match(/<pre[^>]*class=["']ascii["'][^>]*>([\s\S]*?)<\/pre>/i);
    return match?.[1] || '';
  }, []);

  useEffect(() => {
    if (errorMessage) {
      setShowBootArt(false);
      setIsBootArtFading(false);
      setShowReadyLine(false);
      return;
    }

    if (messages.length > 0) {
      setShowBootArt(false);
      setIsBootArtFading(false);
      setShowReadyLine(true);
      return;
    }

    setShowBootArt(true);
    setIsBootArtFading(false);
    setShowReadyLine(false);

    const fadeDelayTimer = window.setTimeout(() => {
      setIsBootArtFading(true);
    }, 5000);

    const fadeCompleteTimer = window.setTimeout(() => {
      setShowBootArt(false);
      setShowReadyLine(true);
    }, 6200);

    return () => {
      window.clearTimeout(fadeDelayTimer);
      window.clearTimeout(fadeCompleteTimer);
    };
  }, [errorMessage, messages.length]);

  return (
    <section className="rounded border border-green-matrix/30 bg-black-light/40 p-5 min-h-[55vh] max-h-[65vh] overflow-y-auto">
      <div className="font-mono text-sm">
        {errorMessage ? (
          <p className="text-red-400">{`> ${errorMessage}`}</p>
        ) : (
          <>
            <p className="text-green-darker">{'> the manuscript v1.0 — loading the showgirl behind this'}</p>
            {showBootArt && (
              <div
                className={`mt-2 overflow-x-auto transition-opacity duration-[1200ms] ease-out ${
                  isBootArtFading ? 'opacity-0' : 'opacity-100'
                }`}
              >
                <pre
                  className="m-0 p-2 whitespace-pre leading-[0.92] tracking-[0.02em] text-[9px] select-none"
                  dangerouslySetInnerHTML={{ __html: bootAsciiMarkup }}
                />
              </div>
            )}
            {showReadyLine && <p className="text-green-darker mt-1">{'> mirrorball v13.0  - ready to talk'}</p>}
          </>
        )}

        {messages.map((message) => (
          <div key={message.id} className="mt-3">
            <p className="whitespace-pre-wrap">
              <span className="text-green-matrix">{'> '}</span>
              <span className={message.role === 'user' ? 'text-blue-400' : 'text-red-400'}>
                {message.role === 'user' ? promptUsername : 'mirrorball'}
              </span>
              <span className="text-green-matrix">@</span>
              <span className="text-yellow-300">the_manuscript</span>
              <span className="text-green-matrix">{':~$ '}</span>
              <span className="text-white">{message.content}</span>
            </p>
          </div>
        ))}

        {isThinking && (
          <div className="mt-3">
            <p className="whitespace-pre-wrap">
              <span className="text-green-matrix">{'> '}</span>
              <span className="text-red-400">mirrorball</span>
              <span className="text-green-matrix">@</span>
              <span className="text-yellow-300">the_manuscript</span>
              <span className="text-green-matrix">{':~$ '}</span>
              <span className="text-white">
                reflecting....<span className="animate-pulse">...</span>
              </span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
