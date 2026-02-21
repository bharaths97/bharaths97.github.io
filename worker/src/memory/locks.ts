import { createMemoryKey } from './store';

const sessionLocks = new Map<string, Promise<void>>();

export const withSessionMemoryLock = async <T>(
  sessionId: string,
  userId: string,
  fn: () => Promise<T>
): Promise<T> => {
  const key = createMemoryKey(sessionId, userId);
  const previousTail = sessionLocks.get(key) || Promise.resolve();

  let release = () => {};
  const currentGate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const currentTail = previousTail.then(() => currentGate);
  sessionLocks.set(key, currentTail);

  await previousTail;
  try {
    return await fn();
  } finally {
    release();
    if (sessionLocks.get(key) === currentTail) {
      sessionLocks.delete(key);
    }
  }
};

export const getMemoryLockStats = (): {
  activeSessionLocks: number;
} => {
  return {
    activeSessionLocks: sessionLocks.size
  };
};

export const resetMemoryLocksForTests = (): void => {
  sessionLocks.clear();
};
