import { describe, expect, it } from 'vitest';
import { applyEdit, duplicateStep, moveStep, type Step } from '../src/core/macro';

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
    const next = duplicateStep(steps, 0, 'copy');
    expect(next.map((s) => s.label)).toEqual(['a', 'a', 'b', 'c']);
    expect(next[1]!.id).toBe('copy');
    next[1]!.locators[0]!.value = 'changed';
    expect(steps[0]!.locators[0]!.value).toBe('a');
  });
});

describe('applyEdit', () => {
  const macro = { id: 'm', name: 'M', steps, delayMs: 0, runs: 1, loop: false };

  it.each([
    [{ type: 'move', stepId: 'a', to: 2 }, ['b', 'c', 'a']],
    [{ type: 'duplicate', stepId: 'a', newId: 'a2' }, ['a', 'a2', 'b', 'c']],
    [{ type: 'delete-step', stepId: 'b' }, ['a', 'c']],
    [{ type: 'delete-step', stepId: 'gone' }, ['a', 'b', 'c']],
  ] as const)('applies %o', (edit, expected) => {
    expect(ids(applyEdit(macro, edit).steps)).toEqual(expected);
  });
});
