import { getAiRuntimeConfig, type AiRuntimeConfig } from './aiConfig';
import { getTieredMemoryConfig, type TieredMemoryConfig } from './memory/config';
import { getMemoryModesForClient } from './memoryModes';
import { getLimits } from './security';
import type { ChatMemoryMode, Env } from './types';

export interface RuntimeConfig {
  limits: ReturnType<typeof getLimits>;
  ai: AiRuntimeConfig;
  memory: TieredMemoryConfig;
  memoryModes: Array<{ id: ChatMemoryMode; display_name: string }>;
}

export const getRuntimeConfig = (env: Env): RuntimeConfig => {
  const limits = getLimits(env);
  const ai = getAiRuntimeConfig(env);
  const memory = getTieredMemoryConfig(env);

  return {
    limits,
    ai,
    memory,
    memoryModes: getMemoryModesForClient(memory.enabled)
  };
};
