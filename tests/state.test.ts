import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { migrate } from '../src/core/macro';
import v1 from './fixtures/v1-storage.json';

const loadState = async () => {
  vi.resetModules();
  return import('../src/bg/state');
};

describe('macros storage', () => {
  beforeEach(() => fakeBrowser.reset());

  it('migrates v1 storage into v2 macros without losing any', async () => {
    await fakeBrowser.storage.local.set(v1);
    const { macros } = await loadState();

    expect(await macros.getValue()).toEqual(migrate(v1.collections as never));
    expect(await fakeBrowser.storage.local.get('collections')).toEqual({ collections: v1.collections });
  });

  it('starts empty on a fresh install', async () => {
    const { macros } = await loadState();
    expect(await macros.getValue()).toEqual([]);
  });

  it('skips an invalid collection, migrates the rest, and keeps raw v1 data', async () => {
    const [good] = Object.values(v1.collections);
    const raw = { collections: { bad: { id: 'bad', name: 'x', steps: [{ id: 's', strategy: 'InputSendKeys', value: 42 }] }, [good!.id]: good } };
    await fakeBrowser.storage.local.set(raw);
    const { macros } = await loadState();

    expect((await macros.getValue()).map((m) => m.id)).toEqual([good!.id]);
    expect(await fakeBrowser.storage.local.get('collections')).toEqual(raw);
  });
});

describe('macro writes', () => {
  beforeEach(() => fakeBrowser.reset());

  const step = { id: 's', label: 'Click Save', locators: [{ kind: 'text' as const, value: 'button Save' }], action: 'click' as const };
  const macro = (id: string, name = id) => ({ id, name, steps: [step], delayMs: 1000, runs: 1, loop: false });
  const repaired = [{ kind: 'id' as const, value: 'save' }];

  it('keeps a recording, a repaired step and a delay change from another tab when the editor renames', async () => {
    const { macros, updateMacros, editMacro } = await loadState();
    await macros.setValue([macro('a')]);

    await Promise.all([
      updateMacros((ms) => [...ms, macro('rec')]),
      updateMacros((ms) => ms.map((m) => ({ ...m, steps: m.steps.map((s) => ({ ...s, locators: repaired })) }))),
      editMacro('a', { type: 'settings', patch: { delayMs: 250 } }),
      editMacro('a', { type: 'settings', patch: { name: 'Renamed' } }),
      editMacro('a', { type: 'step', stepId: 's', patch: { label: 'Press Save' } }),
    ]);

    const [a, rec] = await macros.getValue();
    expect(a).toEqual({ ...macro('a', 'Renamed'), delayMs: 250, steps: [{ ...step, label: 'Press Save', locators: repaired }] });
    expect(rec!.id).toBe('rec');
  });

  it('never brings back a deleted macro', async () => {
    const { macros, deleteMacro, editMacro } = await loadState();
    await macros.setValue([macro('a'), macro('b')]);
    await Promise.all([deleteMacro('b'), editMacro('b', { type: 'settings', patch: { name: 'Late edit' } })]);
    expect((await macros.getValue()).map((m) => m.id)).toEqual(['a']);
  });
});
