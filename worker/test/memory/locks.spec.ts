import { beforeEach, describe, expect, it } from 'vitest';
import { getMemoryLockStats, resetMemoryLocksForTests, withSessionMemoryLock } from '../../src/memory/locks';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('memory locks', () => {
  beforeEach(() => {
    resetMemoryLocksForTests();
  });

  it('serializes work for the same session/user key', async () => {
    const order: string[] = [];

    const first = withSessionMemoryLock('sess-1', 'user-1', async () => {
      order.push('start-1');
      await sleep(20);
      order.push('end-1');
      return 'first';
    });

    const second = withSessionMemoryLock('sess-1', 'user-1', async () => {
      order.push('start-2');
      await sleep(5);
      order.push('end-2');
      return 'second';
    });

    const result = await Promise.all([first, second]);
    expect(result).toEqual(['first', 'second']);
    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    expect(getMemoryLockStats().activeSessionLocks).toBe(0);
  });

  it('allows different sessions to proceed independently', async () => {
    const order: string[] = [];

    await Promise.all([
      withSessionMemoryLock('sess-A', 'user-1', async () => {
        order.push('A-start');
        await sleep(15);
        order.push('A-end');
      }),
      withSessionMemoryLock('sess-B', 'user-1', async () => {
        order.push('B-start');
        await sleep(1);
        order.push('B-end');
      })
    ]);

    expect(order[0]).toBe('A-start');
    expect(order[1]).toBe('B-start');
    expect(order).toContain('A-end');
    expect(order).toContain('B-end');
    expect(getMemoryLockStats().activeSessionLocks).toBe(0);
  });
});
