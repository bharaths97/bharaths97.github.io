import type { ChatMemoryMode } from './types';

interface MemoryModeDefinition {
  id: ChatMemoryMode;
  displayName: string;
  requiresTieredEnabled: boolean;
}

const MEMORY_MODES: MemoryModeDefinition[] = [
  {
    id: 'classic',
    displayName: 'Speak Small',
    requiresTieredEnabled: false
  },
  {
    id: 'tiered',
    displayName: 'Speak Long',
    requiresTieredEnabled: true
  }
];

export const getDefaultMemoryMode = (): ChatMemoryMode => MEMORY_MODES[0]?.id || 'classic';

export const getMemoryModesForClient = (tieredEnabled: boolean): Array<{ id: ChatMemoryMode; display_name: string }> =>
  MEMORY_MODES.filter((mode) => tieredEnabled || !mode.requiresTieredEnabled).map((mode) => ({
    id: mode.id,
    display_name: mode.displayName
  }));

export const isMemoryModeAvailable = (memoryMode: ChatMemoryMode, tieredEnabled: boolean): boolean => {
  const mode = MEMORY_MODES.find((value) => value.id === memoryMode);
  if (!mode) return false;
  return tieredEnabled || !mode.requiresTieredEnabled;
};
