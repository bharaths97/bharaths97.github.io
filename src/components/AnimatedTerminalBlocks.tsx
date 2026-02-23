import { useEffect, useState } from 'react';

interface TerminalBlock {
  command: string;
  output: string;
}

interface ActiveBlockState {
  command: string;
  output: string;
  isTypingCommand: boolean;
}

interface AnimatedTerminalBlocksProps {
  blocks: TerminalBlock[];
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
};

const COMMAND_CHAR_DELAY_MS = 48;
const AFTER_COMMAND_TYPED_DELAY_MS = 380;
const PING_LINE_DELAY_MS = 520;
const AFTER_OUTPUT_DELAY_MS = 360;
const BETWEEN_BLOCK_DELAY_MS = 120;
const CYCLE_RESTART_DELAY_MS = 900;

const shouldRevealPingLineByLine = (block: TerminalBlock, index: number, total: number): boolean => {
  const isLastBlock = index === total - 1;
  const isPingCommand = block.command.trim().toLowerCase().startsWith('ping ');
  return isLastBlock && isPingCommand;
};

export function AnimatedTerminalBlocks({ blocks }: AnimatedTerminalBlocksProps) {
  const [completedBlocks, setCompletedBlocks] = useState<TerminalBlock[]>([]);
  const [activeBlock, setActiveBlock] = useState<ActiveBlockState | null>(null);

  useEffect(() => {
    let cancelled = false;

    const runAnimation = async () => {
      if (blocks.length === 0) return;

      while (!cancelled) {
        setCompletedBlocks([]);
        setActiveBlock(null);

        for (let index = 0; index < blocks.length; index += 1) {
          if (cancelled) return;

          const block = blocks[index];
          setActiveBlock({ command: '', output: '', isTypingCommand: true });

          for (let charIndex = 1; charIndex <= block.command.length; charIndex += 1) {
            if (cancelled) return;

            setActiveBlock((previous) => {
              if (!previous) return previous;
              return {
                ...previous,
                command: block.command.slice(0, charIndex),
                isTypingCommand: true
              };
            });

            await sleep(COMMAND_CHAR_DELAY_MS);
          }

          if (cancelled) return;

          setActiveBlock((previous) => {
            if (!previous) return previous;
            return {
              ...previous,
              isTypingCommand: false
            };
          });

          await sleep(AFTER_COMMAND_TYPED_DELAY_MS);
          if (cancelled) return;

          if (shouldRevealPingLineByLine(block, index, blocks.length)) {
            const outputLines = block.output.split('\n');
            let rendered = '';

            for (const line of outputLines) {
              if (cancelled) return;

              rendered = rendered ? `${rendered}\n${line}` : line;
              setActiveBlock((previous) => {
                if (!previous) return previous;
                return {
                  ...previous,
                  output: rendered
                };
              });

              await sleep(PING_LINE_DELAY_MS);
            }
          } else {
            setActiveBlock((previous) => {
              if (!previous) return previous;
              return {
                ...previous,
                output: block.output
              };
            });
          }

          await sleep(AFTER_OUTPUT_DELAY_MS);
          if (cancelled) return;

          setCompletedBlocks((previous) => [...previous, block]);
          setActiveBlock(null);

          await sleep(BETWEEN_BLOCK_DELAY_MS);
        }

        if (cancelled) return;
        await sleep(CYCLE_RESTART_DELAY_MS);
      }
    };

    void runAnimation();

    return () => {
      cancelled = true;
    };
  }, [blocks]);

  return (
    <div className="mx-auto mb-8 max-w-3xl rounded border border-green-matrix/30 bg-black-light/40 text-left relative overflow-hidden">
      <div className="p-5 opacity-0 pointer-events-none select-none" aria-hidden="true">
        {blocks.map((block, index) => (
          <div key={`static-${index}`} className="mb-3 last:mb-0">
            <p className="font-mono text-sm">
              <span className="text-green-matrix">{'>'} </span>
              <span className="text-red-400">{block.command}</span>
            </p>
            <p className="font-mono text-white text-sm whitespace-pre-line">{block.output}</p>
          </div>
        ))}
      </div>

      <div className="absolute inset-0 p-5">
        {completedBlocks.map((block, index) => (
          <div key={`done-${index}`} className="mb-3 last:mb-0">
            <p className="font-mono text-sm">
              <span className="text-green-matrix">{'>'} </span>
              <span className="text-red-400">{block.command}</span>
            </p>
            <p className="font-mono text-white text-sm whitespace-pre-line">{block.output}</p>
          </div>
        ))}

        {activeBlock && (
          <div className="mb-3 last:mb-0">
            <p className="font-mono text-sm">
              <span className="text-green-matrix">{'>'} </span>
              <span className="text-red-400">{activeBlock.command}</span>
              {activeBlock.isTypingCommand && <span className="animate-[terminal-cursor_1s_infinite]">_</span>}
            </p>
            {activeBlock.output && (
              <p className="font-mono text-white text-sm whitespace-pre-line">{activeBlock.output}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
