export type ChatRole = 'user' | 'assistant';

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

export interface ChatUseCaseState {
  useCaseId: string | null;
  useCaseLockToken: string | null;
  isLocked: boolean;
}
