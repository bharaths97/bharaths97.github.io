import { describe, expect, it } from 'vitest';
import { applyBaseTruthDiff, normalizeBaseTruthDiff } from '../../src/memory/diff';

describe('memory diff', () => {
  it('normalizes diff payload into bounded string arrays', () => {
    const diff = normalizeBaseTruthDiff({
      add: ['  Fact A  ', '', 42, 'Fact B'],
      update: ['Version: 1', 'Version: 1'],
      remove: ['legacy']
    });

    expect(diff.add).toEqual(['Fact A', 'Fact B']);
    expect(diff.update).toEqual(['Version: 1']);
    expect(diff.remove).toEqual(['legacy']);
  });

  it('applies diff in remove -> update -> add order', () => {
    const result = applyBaseTruthDiff(
      ['Python version: 3.10', 'Use recursion for sort'],
      {
        add: ['User prefers iterative implementation'],
        update: ['Python version: 3.12'],
        remove: ['recursion']
      },
      { maxBaseTruthEntries: 20 }
    );

    expect(result.nextBaseTruth).toEqual(['Python version: 3.12', 'User prefers iterative implementation']);
    expect(result.stats.removed).toBe(1);
    expect(result.stats.updated).toBe(1);
    expect(result.stats.added).toBe(1);
  });

  it('treats update-without-match as add fallback', () => {
    const result = applyBaseTruthDiff(
      ['Stack: React + Vite'],
      {
        add: [],
        update: ['Database: D1'],
        remove: []
      },
      { maxBaseTruthEntries: 20 }
    );

    expect(result.nextBaseTruth).toEqual(['Stack: React + Vite', 'Database: D1']);
    expect(result.stats.updated).toBe(0);
    expect(result.stats.added).toBe(1);
  });

  it('enforces max base truth size by trimming oldest entries', () => {
    const result = applyBaseTruthDiff(
      ['A', 'B'],
      {
        add: ['C', 'D'],
        update: [],
        remove: []
      },
      { maxBaseTruthEntries: 3 }
    );

    expect(result.nextBaseTruth).toEqual(['B', 'C', 'D']);
  });
});
