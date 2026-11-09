import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Step } from '../src/core/macro';

const step = (id: string): Step => ({ id, label: 'Click', locators: [], action: 'click' });
let sent: unknown[];

const load = async () => {
  vi.resetModules();
  return import('../src/bg/recording');
};

beforeEach(() => {
  fakeBrowser.reset();
  sent = [];
  fakeBrowser.tabs.sendMessage = vi.fn(async (tabId: number, msg: unknown) => void sent.push([tabId, msg])) as never;
});

describe('recording', () => {
  it('keeps steps from every message in order and saves them as a macro on stop', async () => {
    const r = await load();
    expect(await r.startRecording(1, true)).toBe(true);
    await Promise.all(['a', 'b', 'c'].map((id) => r.addOp(1, { op: 'put', step: step(id) })));
    await r.addOp(2, { op: 'put', step: step('other tab') });
    await r.stopRecording();

    const { macros } = await import('../src/bg/state');
    expect((await macros.getValue()).map((m) => m.steps.map((s) => s.id))).toEqual([['a', 'b', 'c']]);
    expect(await r.recording.getValue()).toBeNull();
    expect(sent).toEqual([[1, { type: 'start', hover: true }], [1, { type: 'stop' }]]);
  });

  it('tells a reloaded page in the recording tab to keep recording', async () => {
    const r = await load();
    await r.startRecording(1);
    expect(await r.hello(1)).toEqual({ hover: false });
    expect(await r.hello(2)).toBeNull();
  });

  it('keeps recording after the background worker restarts', async () => {
    await (await load()).startRecording(1);
    const r = await load();
    await r.addOp(1, { op: 'put', step: step('a') });
    expect((await r.recording.getValue())?.steps.map((s) => s.id)).toEqual(['a']);
  });

  it("doesn't start on a page it can't record", async () => {
    fakeBrowser.tabs.sendMessage = vi.fn(async () => Promise.reject(new Error('no receiver'))) as never;
    const r = await load();
    expect(await r.startRecording(1)).toBe(false);
    expect(await r.recording.getValue()).toBeNull();
  });
});
