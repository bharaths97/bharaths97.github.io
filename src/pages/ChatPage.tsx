import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatTopBar } from '../components/chat/ChatTopBar';
import { ChatTranscript } from '../components/chat/ChatTranscript';
import {
  ChatApiError,
  type ChatAdminUsageResponse,
  getAdminUsageSummary,
  getChatSession,
  postChatReset,
  postChatRespond
} from '../lib/chatApi';
import { getChatAccessLoginUrl, isExternalChatApiConfigured, logoutFromAccessAndRedirect } from '../lib/chatRuntime';
import {
  clearAllChatStorage,
  clearSessionMessages,
  clearSessionUseCaseState,
  getActiveSessionId,
  loadSessionMessages,
  loadSessionUseCaseState,
  saveSessionMessages,
  saveSessionUseCaseState,
  setActiveSessionId
} from '../lib/chatSessionStore';
import type { ChatMessage, ChatUseCaseOption } from '../types/chat';

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

const shouldRedirectToAccessLogin = (error: unknown): boolean => {
  if (error instanceof ChatApiError) {
    return error.status === 401 || error.status === 403;
  }

  return isExternalChatApiConfigured();
};

export function ChatPage() {
  const [username, setUsername] = useState('authorized_user');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [useCases, setUseCases] = useState<ChatUseCaseOption[]>([]);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<string | null>(null);
  const [useCaseLockToken, setUseCaseLockToken] = useState<string | null>(null);
  const [isUseCaseLocked, setIsUseCaseLocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminStatsLoading, setIsAdminStatsLoading] = useState(false);
  const [adminStatsError, setAdminStatsError] = useState<string | null>(null);
  const [adminUsageStats, setAdminUsageStats] = useState<ChatAdminUsageResponse | null>(null);

  const loadAdminUsageStats = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsAdminStatsLoading(true);
      }
      setAdminStatsError(null);

      try {
        const summary = await getAdminUsageSummary({ days: 7, limit: 25 });
        setIsAdmin(true);
        setAdminUsageStats(summary);
      } catch (error) {
        if (error instanceof ChatApiError && error.status === 403) {
          setIsAdmin(false);
          setAdminUsageStats(null);
          return;
        }

        if (error instanceof ChatApiError && error.status === 401) {
          setIsAdmin(false);
          setAdminUsageStats(null);
          setAdminStatsError(error.message);
          return;
        }

        if (error instanceof ChatApiError && error.status === 503) {
          setIsAdmin(true);
          setAdminUsageStats(null);
          setAdminStatsError(error.message);
          return;
        }

        setAdminStatsError('Unable to load admin stats right now.');
      } finally {
        setIsAdminStatsLoading(false);
      }
    },
    []
  );

  const initializeSession = useCallback(async () => {
    setIsSessionLoading(true);
    setErrorMessage(null);

    try {
      const session = await getChatSession();
      const nextSessionId = session.session_id;
      const previousSessionId = getActiveSessionId();

      if (previousSessionId && previousSessionId !== nextSessionId) {
        clearSessionMessages(previousSessionId);
        clearSessionUseCaseState(previousSessionId);
      }

      setActiveSessionId(nextSessionId);
      setSessionId(nextSessionId);
      setMessages(loadSessionMessages(nextSessionId));

      const availableUseCases = Array.isArray(session.prompt_profiles) ? session.prompt_profiles : [];
      const storedUseCaseState = loadSessionUseCaseState(nextSessionId);
      const fallbackUseCaseId = availableUseCases[0]?.id || null;
      const serverSelectedUseCaseId = typeof session.selected_use_case_id === 'string' ? session.selected_use_case_id : null;
      const effectiveUseCaseId = serverSelectedUseCaseId || storedUseCaseState.useCaseId || fallbackUseCaseId;

      setUseCases(availableUseCases);
      setSelectedUseCaseId(effectiveUseCaseId);
      setUseCaseLockToken(storedUseCaseState.useCaseLockToken);
      setIsUseCaseLocked(session.use_case_locked === true || storedUseCaseState.isLocked);

      const nextUsername = session.user.username?.trim() || 'authorized_user';
      setUsername(nextUsername);
      await loadAdminUsageStats({ silent: true });
    } catch (error) {
      if (shouldRedirectToAccessLogin(error)) {
        clearAllChatStorage();
        window.location.assign(getChatAccessLoginUrl());
        return;
      }

      setSessionId(null);
      setMessages([]);
      setUseCases([]);
      setSelectedUseCaseId(null);
      setUseCaseLockToken(null);
      setIsUseCaseLocked(false);
      setIsAdmin(false);
      setAdminUsageStats(null);
      setAdminStatsError(null);
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsSessionLoading(false);
    }
  }, [loadAdminUsageStats]);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    if (!sessionId) return;
    saveSessionMessages(sessionId, messages);
  }, [sessionId, messages]);

  useEffect(() => {
    if (!sessionId) return;
    saveSessionUseCaseState(sessionId, {
      useCaseId: selectedUseCaseId,
      useCaseLockToken,
      isLocked: isUseCaseLocked
    });
  }, [sessionId, selectedUseCaseId, useCaseLockToken, isUseCaseLocked]);

  const canSend = useMemo(
    () =>
      input.trim().length > 0 &&
      !isThinking &&
      !isSessionLoading &&
      Boolean(sessionId) &&
      (useCases.length === 0 || Boolean(selectedUseCaseId)),
    [input, isThinking, isSessionLoading, sessionId, selectedUseCaseId, useCases.length]
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
        use_case_id: selectedUseCaseId || undefined,
        use_case_lock_token: useCaseLockToken || undefined,
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

      const nextUseCaseId = response.session?.use_case_id || selectedUseCaseId;
      const nextUseCaseLockToken = response.session?.use_case_lock_token || useCaseLockToken;
      const nextUseCaseLocked = response.session?.use_case_locked === true || Boolean(nextUseCaseLockToken);

      setSelectedUseCaseId(nextUseCaseId || null);
      setUseCaseLockToken(nextUseCaseLockToken || null);
      setIsUseCaseLocked(nextUseCaseLocked);
      setMessages((prev) => [...prev, newMessage('assistant', assistantText)]);
    } catch (error) {
      if (error instanceof ChatApiError && (error.status === 401 || error.status === 403)) {
        clearAllChatStorage();
        await logoutFromAccessAndRedirect();
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
    setIsAdmin(false);
    setAdminUsageStats(null);
    setAdminStatsError(null);
    await logoutFromAccessAndRedirect();
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

      <ChatTopBar
        username={username}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        isAdminStatsLoading={isAdminStatsLoading}
        adminStatsError={adminStatsError}
        adminUsageStats={adminUsageStats}
        onRefreshAdminStats={() => void loadAdminUsageStats()}
      />

      <main className="relative z-10 pt-20 px-4 pb-8">
        <div className="max-w-5xl mx-auto space-y-4">
          {isSessionLoading && (
            <div className="border border-green-matrix/30 bg-black-light/40 px-4 py-2 text-sm font-mono text-green-dark">
              {'> loading session context...'}
            </div>
          )}

          <ChatTranscript messages={messages} isThinking={isThinking} username={username} errorMessage={errorMessage} />
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => void handleSend()}
            useCases={useCases}
            selectedUseCaseId={selectedUseCaseId}
            onUseCaseChange={(nextUseCaseId) => {
              setSelectedUseCaseId(nextUseCaseId);
              if (!isUseCaseLocked) {
                setUseCaseLockToken(null);
              }
            }}
            useCaseLocked={isUseCaseLocked}
            disabled={!canSend}
          />
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
