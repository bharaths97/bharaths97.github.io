export type TurnComplexity = 'short' | 'medium' | 'long' | 'code_heavy';

const countWords = (value: string): number => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length;
};

const isCodeHeavy = (value: string): boolean => {
  return /```|[{;}()=>]|function\s+\w+|class\s+\w+|interface\s+\w+|type\s+\w+/i.test(value);
};

export const classifyTurnComplexity = (userMessage: string, assistantMessage: string): TurnComplexity => {
  if (isCodeHeavy(userMessage) || isCodeHeavy(assistantMessage)) {
    return 'code_heavy';
  }

  const userWords = countWords(userMessage);
  const assistantWords = countWords(assistantMessage);

  if (userWords < 40 && assistantWords < 40) return 'short';
  if (userWords > 200 || assistantWords > 200) return 'long';
  return 'medium';
};

export const shouldExtractDiff = (complexity: TurnComplexity): boolean => {
  return complexity !== 'short';
};
