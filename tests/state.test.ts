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
    expect(await fakeBrowser.storage.local.get('collections$')).toEqual({ collections$: { v: 2 } });
  });

  it('starts empty on a fresh install', async () => {
    const { macros } = await loadState();
    expect(await macros.getValue()).toEqual([]);
  });

  it('leaves v1 data untouched if migration fails', async () => {
    const broken = { collections: { x: { id: 'x', name: 'x', steps: [{ id: 's', strategy: 'InputSendKeys', value: 42 }] } } };
    await fakeBrowser.storage.local.set(broken);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { macros } = await loadState();
    await macros.getValue();

    expect(await fakeBrowser.storage.local.get('collections')).toEqual(broken);
  });
});
