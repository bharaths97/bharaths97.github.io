import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatTopBar } from '../components/chat/ChatTopBar';
import { ChatTranscript } from '../components/chat/ChatTranscript';
import { ChatApiError, getChatSession, postChatReset, postChatRespond } from '../lib/chatApi';
import { getChatLogoutUrl } from '../lib/chatRuntime';
import {
  clearAllChatStorage,
  clearSessionMessages,
  getActiveSessionId,
  loadSessionMessages,
  saveSessionMessages,
  setActiveSessionId
} from '../lib/chatSessionStore';
import type { ChatMessage } from '../types/chat';

const newMessage = (role: ChatMessage['role'], content: string): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: new Date().toISOString()
});

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof ChatApiError) {
    return error.message;
  }

  return 'Unable to reach chat backend right now.';
};

const CHAT_LOGOUT_URL = getChatLogoutUrl();

export function ChatPage() {
  const [username, setUsername] = useState('authorized_user');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initializeSession = useCallback(async () => {
    setIsSessionLoading(true);
    setErrorMessage(null);

    try {
      const session = await getChatSession();
      const nextSessionId = session.session_id;
      const previousSessionId = getActiveSessionId();

      if (previousSessionId && previousSessionId !== nextSessionId) {
        clearSessionMessages(previousSessionId);
      }

      setActiveSessionId(nextSessionId);
      setSessionId(nextSessionId);
      setMessages(loadSessionMessages(nextSessionId));

      const nextUsername = session.user.display_name?.trim() || session.user.email || 'authorized_user';
      setUsername(nextUsername);
    } catch (error) {
      setSessionId(null);
      setMessages([]);
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    if (!sessionId) return;
    saveSessionMessages(sessionId, messages);
  }, [sessionId, messages]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !isThinking && !isSessionLoading && Boolean(sessionId),
    [input, isThinking, isSessionLoading, sessionId]
  );

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isThinking || isSessionLoading || !sessionId) return;

    const userMessage = newMessage('user', trimmed);
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput('');
    setIsThinking(true);
    setErrorMessage(null);

    try {
      const response = await postChatRespond({
        session_id: sessionId,
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
          ts: message.createdAt
        }))
      });

      const assistantText = response.assistant_message?.content?.trim();
      if (!assistantText) {
        setErrorMessage('Assistant returned an empty response.');
        return;
      }

      setMessages((prev) => [...prev, newMessage('assistant', assistantText)]);
    } catch (error) {
      if (error instanceof ChatApiError && (error.status === 401 || error.status === 403)) {
        clearAllChatStorage();
        window.location.assign(CHAT_LOGOUT_URL);
        return;
      }

      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsThinking(false);
    }
  };

  const handleLogout = async () => {
    const currentSessionId = sessionId;

    if (currentSessionId) {
      try {
        await postChatReset(currentSessionId);
      } catch {
        // Ignore reset failures and continue logout.
      }
    }

    clearAllChatStorage();
    window.location.assign(CHAT_LOGOUT_URL);
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

      <ChatTopBar username={username} onLogout={handleLogout} />

      <main className="relative z-10 pt-20 px-4 pb-8">
        <div className="max-w-5xl mx-auto space-y-4">
          {isSessionLoading && (
            <div className="border border-green-matrix/30 bg-black-light/40 px-4 py-2 text-sm font-mono text-green-dark">
              {'> loading session context...'}
            </div>
          )}

          <ChatTranscript messages={messages} isThinking={isThinking} errorMessage={errorMessage} />
          <ChatComposer value={input} onChange={setInput} onSend={() => void handleSend()} disabled={!canSend} />
        </div>
      </main>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
}
