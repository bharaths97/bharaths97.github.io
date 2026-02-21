import { BarChart3, LogOut, RefreshCw, Shield, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ChatAdminUsageResponse } from '../../lib/chatApi';

interface ChatTopBarProps {
  username: string;
  onLogout: () => void;
  isAdmin: boolean;
  isAdminStatsLoading: boolean;
  adminStatsError: string | null;
  adminUsageStats: ChatAdminUsageResponse | null;
  onRefreshAdminStats: () => void;
}

const formatLastSeen = (value: string | null): string => {
  if (!value) return 'n/a';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'n/a';
  return new Date(parsed).toLocaleString();
};

export function ChatTopBar({
  username,
  onLogout,
  isAdmin,
  isAdminStatsLoading,
  adminStatsError,
  adminUsageStats,
  onRefreshAdminStats
}: ChatTopBarProps) {
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const topUser = useMemo(() => adminUsageStats?.users[0] || null, [adminUsageStats]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-black-deep/90 backdrop-blur-sm border-b border-green-matrix/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <Terminal className="w-6 h-6 text-green-matrix" />
            <span className="text-green-matrix font-mono tracking-wider"> the_manuscript.init</span>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsStatsOpen((open) => !open)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-green-matrix/40 text-green-dark hover:text-black hover:bg-green-matrix transition-all duration-300 font-mono text-xs"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                  {adminUsageStats && (
                    <span className="text-[11px] text-green-dark/80">{`req:${adminUsageStats.totals.requests}`}</span>
                  )}
                </button>

                {isStatsOpen && (
                  <div className="absolute right-0 mt-2 w-[360px] border border-green-matrix/35 bg-black-deep/95 backdrop-blur-sm p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-green-matrix text-xs flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Usage stats
                      </span>
                      <button
                        type="button"
                        onClick={onRefreshAdminStats}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-green-matrix/35 text-green-dark hover:text-black hover:bg-green-matrix transition-all duration-300 font-mono text-[11px]"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                      </button>
                    </div>

                    {isAdminStatsLoading && <p className="font-mono text-xs text-green-dark">{'> loading usage stats...'}</p>}

                    {!isAdminStatsLoading && adminStatsError && (
                      <p className="font-mono text-xs text-red-400">{`> ${adminStatsError}`}</p>
                    )}

                    {!isAdminStatsLoading && !adminStatsError && adminUsageStats && (
                      <div className="font-mono text-xs text-white space-y-2">
                        <p className="text-green-dark">{`window: ${adminUsageStats.window_days} days`}</p>
                        <p>{`requests=${adminUsageStats.totals.requests} | input=${adminUsageStats.totals.input_tokens} | output=${adminUsageStats.totals.output_tokens} | users=${adminUsageStats.totals.active_users}`}</p>
                        {topUser && (
                          <p className="text-green-dark">{`top user: ${topUser.username} (${topUser.user_id}) req=${topUser.requests}`}</p>
                        )}
                        {adminUsageStats.users.length > 0 && (
                          <div className="max-h-36 overflow-y-auto border border-green-matrix/20 p-2 bg-black-light/40">
                            {adminUsageStats.users.map((user) => (
                              <p key={user.user_id} className="text-[11px] leading-relaxed">
                                {`${user.username} (${user.user_id}) | req:${user.requests} in:${user.input_tokens} out:${user.output_tokens} last:${formatLastSeen(user.last_seen)}`}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
