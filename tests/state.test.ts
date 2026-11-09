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

  const macro = (id: string, name = id) => ({ id, name, steps: [], delayMs: 0, runs: 1, loop: false });

  it('keeps a recording saved while an edit is on its way, and never brings back a deleted macro', async () => {
    const { macros, updateMacros, saveMacro, deleteMacro } = await loadState();
    await macros.setValue([macro('a'), macro('b')]);

    await Promise.all([updateMacros((ms) => [...ms, macro('rec')]), saveMacro(macro('a', 'Renamed')), deleteMacro('b'), saveMacro(macro('b', 'Late edit'))]);

    expect(await macros.getValue()).toEqual([macro('a', 'Renamed'), macro('rec')]);
  });
});
