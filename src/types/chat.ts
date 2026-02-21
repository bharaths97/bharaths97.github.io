export type ChatRole = 'user' | 'assistant';
export type ChatMemoryMode = 'classic' | 'tiered';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatUseCaseOption {
  id: string;
  display_name: string;
}

export interface ChatMemoryModeOption {
  id: ChatMemoryMode;
  display_name: string;
}

export interface ChatUseCaseState {
  useCaseId: string | null;
  memoryMode: ChatMemoryMode | null;
  useCaseLockToken: string | null;
  isLocked: boolean;
}
