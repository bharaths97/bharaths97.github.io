import USE_CASE_1_PROMPT from './Gen.md';
import USE_CASE_2_PROMPT from './Cat.md';
import USE_CASE_3_PROMPT from './Upsc.md';
import type { Env } from '../types';

export interface PromptProfile {
  id: string;
  displayName: string;
  sourceFile: string;
  systemPrompt: string;
}

interface PromptProfileDefinition {
  id: string;
  displayName: string;
  sourceFile: string;
  defaultPrompt: string;
  envKey?: 'USE_CASE_PROMPT_GEN' | 'USE_CASE_PROMPT_CAT' | 'USE_CASE_PROMPT_UPSC';
}

const PROMPT_PROFILES: PromptProfileDefinition[] = [
  {
    id: 'gen',
    displayName: 'JackOfAllTrades',
    sourceFile: 'worker/src/prompts/Gen.md',
    defaultPrompt: USE_CASE_1_PROMPT,
    envKey: 'USE_CASE_PROMPT_GEN'
  },
  {
    id: 'cat',
    displayName: 'CAT',
    sourceFile: 'worker/src/prompts/Cat.md',
    defaultPrompt: USE_CASE_2_PROMPT,
    envKey: 'USE_CASE_PROMPT_CAT'
  },
  {
    id: 'upsc',
    displayName: 'UPSC',
    sourceFile: 'worker/src/prompts/Upsc.md',
    defaultPrompt: USE_CASE_3_PROMPT,
    envKey: 'USE_CASE_PROMPT_UPSC'
  }
];

const DEFAULT_PROMPT_PROFILE_ID = PROMPT_PROFILES[0]?.id || 'gen';

const resolvePromptText = (profile: PromptProfileDefinition, env: Env): string => {
  const override = profile.envKey ? env[profile.envKey]?.trim() : '';
  return override || profile.defaultPrompt;
};

// Backward compatibility: previously selection ids could include a "__" suffix.
const normalizePromptProfileId = (id: string): string => {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;
  const [baseId] = trimmed.split('__');
  return baseId || trimmed;
};

export const getPromptProfilesForClient = (): Array<{ id: string; display_name: string }> =>
  PROMPT_PROFILES.map((profile) => ({
    id: profile.id,
    display_name: profile.displayName
  }));

export const getDefaultPromptProfileId = (): string => DEFAULT_PROMPT_PROFILE_ID;

export const getPromptProfile = (id: string, env: Env): PromptProfile | null => {
  const normalizedId = normalizePromptProfileId(id);
  const profile = PROMPT_PROFILES.find((value) => value.id === normalizedId);
  if (!profile) return null;

  return {
    id: profile.id,
    displayName: profile.displayName,
    sourceFile: profile.sourceFile,
    systemPrompt: resolvePromptText(profile, env)
  };
};
