import { describe, expect, it, vi } from 'vitest';
import { createRequestLogger } from '../src/logger';
import { buildEnv } from './helpers';

describe('logger sanitization', () => {
  it('keeps token count metrics while redacting sensitive token values', () => {
    const env = buildEnv({ LOG_LEVEL: 'info' });
    const logger = createRequestLogger(env, {
      requestId: 'req-1',
      method: 'POST',
      path: '/api/chat/respond'
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      logger.info('chat.respond.success', {
        input_tokens: 123,
        output_tokens: 45,
        total_tokens: 168,
        use_case_lock_token: 'super-secret-token-value',
        authorization: 'Bearer abc'
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const entry = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;

      expect(entry.input_tokens).toBe(123);
      expect(entry.output_tokens).toBe(45);
      expect(entry.total_tokens).toBe(168);
      expect(entry.use_case_lock_token).toBe('[redacted]');
      expect(entry.authorization).toBe('[redacted]');
    } finally {
      logSpy.mockRestore();
    }
  });
});
