import { useCallback, useEffect, useState } from 'react';
import { TerminalTopBar } from '../components/layout/TerminalTopBar';
import { ChatApiError, getAdminUsageSummary, getChatSession, postChatReset, type ChatAdminUsageResponse } from '../lib/chatApi';
import { getChatAccessLoginUrl, isExternalChatApiConfigured, logoutFromAccessAndRedirect } from '../lib/chatRuntime';
import { clearAllChatStorage } from '../lib/chatSessionStore';

type ControlModule = 'usage';

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof ChatApiError) {
    return error.message;
  }

  return 'Unable to load control center right now.';
};

const shouldRedirectToAccessLogin = (error: unknown): boolean => {
  if (error instanceof ChatApiError) {
    return error.status === 401 || error.status === 403;
  }

  return isExternalChatApiConfigured();
};

const formatLastSeen = (value: string | null): string => {
  if (!value) return 'n/a';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'n/a';
  return new Date(parsed).toLocaleString();
};

export function AdminControlPage() {
  const [username, setUsername] = useState('authorized_user');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ControlModule>('usage');
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<ChatAdminUsageResponse | null>(null);

  const loadUsageStats = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);

    try {
      const summary = await getAdminUsageSummary({ days: 7, limit: 25 });
      setUsageStats(summary);
    } catch (error) {
      if (error instanceof ChatApiError && error.status === 401) {
        clearAllChatStorage();
        window.location.assign(getChatAccessLoginUrl());
        return;
      }

      if (error instanceof ChatApiError && error.status === 403) {
        window.location.hash = '/chat';
        return;
      }

      setUsageError(formatErrorMessage(error));
      setUsageStats(null);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const initialize = useCallback(async () => {
    setIsSessionLoading(true);
    setErrorMessage(null);

    try {
      const session = await getChatSession();
      if (session.capabilities?.control_center !== true) {
        window.location.hash = '/chat';
        return;
      }

      setSessionId(session.session_id);
      setUsername(session.user.username?.trim() || 'authorized_user');
      await loadUsageStats();
    } catch (error) {
      if (shouldRedirectToAccessLogin(error)) {
        clearAllChatStorage();
        window.location.assign(getChatAccessLoginUrl());
        return;
      }

      setSessionId(null);
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsSessionLoading(false);
    }
  }, [loadUsageStats]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const handleLogout = async () => {
    if (sessionId) {
      try {
        await postChatReset(sessionId);
      } catch {
        // Ignore reset failures and continue logout.
      }
    }

    clearAllChatStorage();
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

      <TerminalTopBar
        leftLabel="control_center.init"
        items={[
          {
            id: 'chat',
            label: 'chat',
            onClick: () => {
              window.location.hash = '/chat';
            }
          },
          {
            id: 'username',
            label: username
          },
          {
            id: 'logout',
            label: 'logout',
            onClick: handleLogout
          }
        ]}
      />

      <main className="relative z-10 pt-20 px-4 pb-8">
        <div className="max-w-6xl mx-auto space-y-4">
          {isSessionLoading && (
            <div className="border border-green-matrix/30 bg-black-light/40 px-4 py-2 text-sm font-mono text-green-dark">
              {'> loading control center...'}
            </div>
          )}

          {errorMessage && (
            <div className="border border-red-400/30 bg-black-light/40 px-4 py-2 text-sm font-mono text-red-400">{`> ${errorMessage}`}</div>
          )}

          <section className="rounded border border-green-matrix/30 bg-black-light/40 p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveModule('usage')}
                className={`font-mono text-sm transition-colors ${
                  activeModule === 'usage' ? 'text-green-matrix' : 'text-green-dark hover:text-green-matrix'
                }`}
              >
                {'> usage'}
              </button>
            </div>
          </section>

          {activeModule === 'usage' && (
            <section className="rounded border border-green-matrix/30 bg-black-light/40 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-mono text-green-matrix">{'> usage.telemetry'}</h2>
                <button
                  type="button"
                  onClick={() => void loadUsageStats()}
                  className="font-mono text-xs text-green-dark hover:text-green-matrix transition-colors"
                >
                  {'> refresh'}
                </button>
              </div>

              {usageLoading && <p className="font-mono text-sm text-green-dark">{'> loading usage stats...'}</p>}
              {usageError && <p className="font-mono text-sm text-red-400">{`> ${usageError}`}</p>}

              {!usageLoading && !usageError && usageStats && (
                <div className="space-y-3 font-mono text-sm">
                  <p className="text-green-dark">{`window: ${usageStats.window_days} days`}</p>
                  <p className="text-white">
                    {`requests=${usageStats.totals.requests} | input=${usageStats.totals.input_tokens} | output=${usageStats.totals.output_tokens} | active_users=${usageStats.totals.active_users}`}
                  </p>

                  <div className="overflow-x-auto border border-green-matrix/20 bg-black-deep/50">
                    <table className="w-full min-w-[640px] text-xs">
                      <thead>
                        <tr className="text-green-dark border-b border-green-matrix/20">
                          <th className="px-2 py-2 text-left">user</th>
                          <th className="px-2 py-2 text-left">user_id</th>
                          <th className="px-2 py-2 text-right">requests</th>
                          <th className="px-2 py-2 text-right">input</th>
                          <th className="px-2 py-2 text-right">output</th>
                          <th className="px-2 py-2 text-left">last_seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageStats.users.map((user) => (
                          <tr key={user.user_id} className="text-white border-b border-green-matrix/10 last:border-b-0">
                            <td className="px-2 py-2">{user.username}</td>
                            <td className="px-2 py-2">{user.user_id}</td>
                            <td className="px-2 py-2 text-right">{user.requests}</td>
                            <td className="px-2 py-2 text-right">{user.input_tokens}</td>
                            <td className="px-2 py-2 text-right">{user.output_tokens}</td>
                            <td className="px-2 py-2">{formatLastSeen(user.last_seen)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
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
