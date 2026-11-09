import { describe, expect, it } from 'vitest';
import { duplicateStep, moveStep, type Step } from '../src/core/macro';

const steps: Step[] = ['a', 'b', 'c'].map((id) => ({ id, label: id, locators: [{ kind: 'id', value: id }], action: 'click' }));
const ids = (s: Step[]) => s.map((x) => x.id);

describe('moveStep', () => {
  it.each([
    [0, 2, ['b', 'c', 'a']],
    [2, 0, ['c', 'a', 'b']],
    [1, 1, ['a', 'b', 'c']],
    [0, -1, ['a', 'b', 'c']],
    [2, 3, ['a', 'b', 'c']],
  ])('moves %i to %i', (from, to, expected) => {
    expect(ids(moveStep(steps, from, to))).toEqual(expected);
  });
});

describe('duplicateStep', () => {
  it('inserts an independent copy with a new id after the original', () => {
    const next = duplicateStep(steps, 0);
    expect(next.map((s) => s.label)).toEqual(['a', 'a', 'b', 'c']);
    expect(next[1]!.id).not.toBe('a');
    next[1]!.locators[0]!.value = 'changed';
    expect(steps[0]!.locators[0]!.value).toBe('a');
  });
});
