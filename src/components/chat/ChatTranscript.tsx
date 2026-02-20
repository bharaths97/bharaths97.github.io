import type { ChatMessage } from '../../types/chat';

interface ChatTranscriptProps {
  messages: ChatMessage[];
  isThinking: boolean;
  errorMessage?: string | null;
}

export function ChatTranscript({ messages, isThinking, errorMessage = null }: ChatTranscriptProps) {
  return (
    <section className="rounded border border-green-matrix/30 bg-black-light/40 p-5 min-h-[55vh] max-h-[65vh] overflow-y-auto">
      <div className="font-mono text-sm">
        {errorMessage ? (
          <p className="text-red-400">{`> ${errorMessage}`}</p>
        ) : (
          <>
            <p className="text-green-darker">{'> the manuscript v1.0 — reflective runtime engaged'}</p>
            <p className="text-green-darker mt-1">{'> mirrorball v13.0  - awakened from sleep'}</p>
          </>
        )}

        {messages.map((message) => (
          <div key={message.id} className="mt-3">
            <p className="whitespace-pre-wrap">
              <span className="text-green-matrix">{'> '}</span>
              <span className={message.role === 'user' ? 'text-blue-400' : 'text-red-400'}>
                {message.role === 'user' ? 'user' : 'mirrorball'}
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
