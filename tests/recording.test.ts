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

  it('names the macro after the start page, or the date when there is none', async () => {
    const r = await load();
    await r.startRecording(1);
    await r.firstPage(1, 'https://www.example.com/login', 'Log in | Example');
    await r.stopRecording();
    await r.startRecording(1);
    await r.addOp(1, { op: 'put', step: step('a') });
    await r.stopRecording();

    const { macros } = await import('../src/bg/state');
    const [first, second] = (await macros.getValue()).map((m) => m.name);
    expect(first).toBe('Log in · example.com');
    expect(second).toMatch(/^New macro /);
  });

  it('tells a reloaded page in the recording tab to keep recording', async () => {
    const r = await load();
    await r.startRecording(1);
    expect(await r.hello(1, { url: 'https://a.io/', top: true })).toEqual({ hover: false });
    expect(await r.hello(2, { url: 'https://b.io/', top: true })).toBeNull();
  });

  it('records the start page, page changes, and tabs opened from the recording', async () => {
    const r = await load();
    await r.startRecording(1);
    await r.firstPage(1, 'https://a.io/login');
    await r.addOp(1, { op: 'put', step: step('submit') });
    await r.hello(1, { url: 'https://a.io/redirect', top: true });
    await r.hello(1, { url: 'https://a.io/home', top: true });
    await r.hello(1, { url: 'https://ads.io/frame', top: false });
    expect(await r.hello(2, { url: 'https://a.io/report', top: true, openerTabId: 1 })).toEqual({ hover: false });
    await r.addOp(2, { op: 'put', step: step('download') });

    expect((await r.recording.getValue())?.steps.map(({ id, locators, ...s }) => s)).toEqual([
      { label: 'Go to a.io/login', action: 'navigate', url: 'https://a.io/login', newTab: false },
      { label: 'Click', action: 'click' },
      { label: 'Go to a.io/home', action: 'navigate', url: 'https://a.io/home', newTab: false },
      { label: 'Open a.io/report in a new tab', action: 'navigate', url: 'https://a.io/report', newTab: true },
      { label: 'Click', action: 'click' },
    ]);
  });

  it('keeps recording after the background worker restarts', async () => {
    await (await load()).startRecording(1);
    const r = await load();
    await r.addOp(1, { op: 'put', step: step('a') });
    expect((await r.recording.getValue())?.steps.map((s) => s.id)).toEqual(['a']);
  });

  it('marks a new tab even when one of its frames loads first', async () => {
    const r = await load();
    await r.startRecording(1);
    expect(await r.hello(2, { url: 'https://ads.io/frame', top: false, openerTabId: 1 })).toEqual({ hover: false });
    await r.hello(2, { url: 'https://a.io/report', top: true, openerTabId: 1 });
    expect((await r.recording.getValue())?.steps).toEqual([expect.objectContaining({ url: 'https://a.io/report', newTab: true })]);
  });

  it('keeps the recording when saving the macro fails', async () => {
    const r = await load();
    await r.startRecording(1);
    await r.addOp(1, { op: 'put', step: step('a') });
    const { macros } = await import('../src/bg/state');
    vi.spyOn(macros, 'setValue').mockRejectedValueOnce(new Error('quota'));

    await expect(r.stopRecording()).rejects.toThrow('quota');
    expect((await r.recording.getValue())?.steps.map((s) => s.id)).toEqual(['a']);
    await r.stopRecording();
    expect((await macros.getValue()).map((m) => m.steps.length)).toEqual([1]);
  });

  it("doesn't start on a page it can't record", async () => {
    fakeBrowser.tabs.sendMessage = vi.fn(async () => Promise.reject(new Error('no receiver'))) as never;
    const r = await load();
    expect(await r.startRecording(1)).toBe(false);
    expect(await r.recording.getValue()).toBeNull();
  });
});
