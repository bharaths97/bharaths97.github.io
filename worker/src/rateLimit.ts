import { AuthError } from './access';
import type { AuthContext, Env } from './types';

interface LimitResult {
  success: boolean;
}

const makeRateLimitKey = (auth: AuthContext): string => {
  const subject = auth.claims.sub || 'unknown';
  return `respond:${subject}`;
};

const applyLimiter = async (
  limiter: { limit: (options: { key: string }) => Promise<LimitResult> } | undefined,
  key: string,
  code: string
): Promise<void> => {
  if (!limiter) return;

  const result = await limiter.limit({ key });
  if (!result.success) {
    throw new AuthError('Rate limit exceeded. Slow down and retry.', 429, code);
  }
};

export const enforceRespondRateLimit = async (auth: AuthContext, env: Env): Promise<void> => {
  const key = makeRateLimitKey(auth);

  await applyLimiter(env.RESPOND_BURST_LIMITER, key, 'RATE_LIMITED_BURST');
  await applyLimiter(env.RESPOND_MINUTE_LIMITER, key, 'RATE_LIMITED');
};
