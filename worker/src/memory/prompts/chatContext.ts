import type { SessionMemoryState } from '../types';
import CHAT_CONTEXT_TEMPLATE_MARKDOWN from './ChatContextTemplate.md';

const renderBaseTruthBlock = (memory: SessionMemoryState): string => {
  if (memory.baseTruth.length === 0) {
    return '- (none yet)';
  }

  return memory.baseTruth.map((fact) => `- ${fact}`).join('\n');
};

const renderTurnSummaryBlock = (memory: SessionMemoryState): string => {
  if (memory.turnLog.length === 0) {
    return '- (none yet)';
  }

  return memory.turnLog
    .map((turn) => `- Turn ${turn.turn}: User: ${turn.user_summary} | You: ${turn.assistant_summary}`)
    .join('\n');
};

export const buildTieredChatSystemPrompt = (basePrompt: string, memory: SessionMemoryState): string => {
  return CHAT_CONTEXT_TEMPLATE_MARKDOWN
    .replace('{{BASE_PROMPT}}', basePrompt.trim())
    .replace('{{ESTABLISHED_FACTS}}', renderBaseTruthBlock(memory))
    .replace('{{TURN_SUMMARIES}}', renderTurnSummaryBlock(memory))
    .trim();
};
