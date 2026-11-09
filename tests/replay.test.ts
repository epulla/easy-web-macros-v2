import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Macro, Step } from '../src/core/macro';
import type { ToPage } from '../src/bg/replay';

const click = (id: string): Step => ({ id, label: 'Click', locators: [], action: 'click' });
const go = (id: string, url: string, newTab = false): Step => ({ id, label: 'Go', locators: [], action: 'navigate', url, newTab });

let played: [number, string][];
let page: (tabId: number, msg: ToPage) => unknown;
let r: typeof import('../src/bg/replay');

const load = async () => {
  vi.resetModules();
  r = await import('../src/bg/replay');
};
const save = async (steps: Step[], extra: Partial<Macro> = {}) => {
  const { macros } = await import('../src/bg/state');
  await macros.setValue([{ id: 'm', name: 'Login', steps, delayMs: 0, runs: 1, loop: false, ...extra }]);
};
const until = async (state: string) => {
  await vi.waitFor(async () => expect((await r.run.getValue())?.state).toBe(state), { timeout: 3000 });
  return (await r.run.getValue())!;
};

beforeEach(async () => {
  fakeBrowser.reset();
  played = [];
  page = (tabId, msg) => (msg.type === 'play' ? (played.push([tabId, msg.step.id]), { ok: true }) : 'https://a.io/');
  fakeBrowser.tabs.sendMessage = vi.fn(async (tabId: number, msg: ToPage) => page(tabId, msg)) as never;
  fakeBrowser.tabs.update = vi.fn(async () => ({})) as never;
  fakeBrowser.tabs.create = vi.fn(async () => ({ id: 9 })) as never;
  await load();
});

describe('replay', () => {
  it('plays every step in order and waits for the page a click opens', async () => {
    await save([go('start', 'https://a.io/'), click('submit'), go('home', 'https://a.io/home'), click('menu')]);
    page = (tabId, msg) => {
      if (msg.type !== 'play') return 'https://a.io/';
      played.push([tabId, msg.step.id]);
      if (msg.step.id === 'submit') setTimeout(() => r.pageLoaded(1), 50);
      return { ok: true };
    };
    await r.play('m', 1);

    const done = await until('done');
    expect(played).toEqual([[1, 'submit'], [1, 'menu']]);
    expect(done.status).toEqual(['done', 'done', 'done', 'done']);
    expect(fakeBrowser.tabs.update).not.toHaveBeenCalled();
  });

  it('opens the start page when the tab is somewhere else', async () => {
    await save([go('start', 'https://b.io/')]);
    fakeBrowser.tabs.update = vi.fn(async () => (setTimeout(() => r.pageLoaded(1), 10), {})) as never;
    await r.play('m', 1);
    await until('done');
    expect(fakeBrowser.tabs.update).toHaveBeenCalledWith(1, { url: 'https://b.io/' });
  });

  it('follows a tab opened by a click', async () => {
    await save([click('report'), go('tab', 'https://a.io/report', true), click('download')]);
    page = (tabId, msg) => {
      if (msg.type === 'play') played.push([tabId, msg.step.id]);
      if (msg.type === 'play' && msg.step.id === 'report') setTimeout(() => r.pageLoaded(2, 1), 10);
      return { ok: true };
    };
    await r.play('m', 1);
    expect((await until('done')).tabId).toBe(2);
    expect(played).toEqual([[1, 'report'], [2, 'download']]);
  });

  it('stops at a failing step and retries it on resume', async () => {
    await save([click('a'), click('b'), click('c')]);
    let fail = true;
    page = (tabId, msg) => {
      if (msg.type !== 'play') return '';
      played.push([tabId, msg.step.id]);
      return msg.step.id === 'b' && fail ? { error: 'missing' } : { ok: true };
    };
    await r.play('m', 1);
    const failed = await until('failed');
    expect(failed).toMatchObject({ index: 1, message: 'Step 2: missing', status: ['done', 'failed', 'pending'] });

    fail = false;
    await r.resume();
    expect((await until('done')).status).toEqual(['done', 'done', 'done']);
    expect(played.map(([, id]) => id)).toEqual(['a', 'b', 'b', 'c']);
  });

  it('pauses after the current step, resumes, and stops', async () => {
    await save([click('a'), click('b'), click('c')]);
    page = (tabId, msg) => {
      if (msg.type !== 'play') return '';
      played.push([tabId, msg.step.id]);
      if (msg.step.id === 'a') void r.pause();
      return { ok: true };
    };
    await r.play('m', 1);
    expect(await until('paused')).toMatchObject({ index: 1, status: ['done', 'pending', 'pending'] });

    await r.resume();
    await until('done');
    expect(played.map(([, id]) => id)).toEqual(['a', 'b', 'c']);

    await r.play('m', 1, { from: 2 });
    await r.stopRun();
    expect(await r.run.getValue()).toBeNull();
  });

  it('plays from a chosen step and repeats for each run', async () => {
    await save([click('a'), click('b')], { runs: 2 });
    await r.play('m', 1, { from: 1 });
    await until('done');
    expect(played.map(([, id]) => id)).toEqual(['b', 'a', 'b']);
  });

  it('keeps playing after the background worker restarts', async () => {
    await save([click('a'), click('b')]);
    page = (_, msg) => (msg.type === 'play' && msg.step.id === 'a' ? new Promise(() => {}) : { ok: true });
    await r.play('m', 1);
    await vi.waitFor(() => expect(fakeBrowser.tabs.sendMessage).toHaveBeenCalled());

    page = (tabId, msg) => (msg.type === 'play' && played.push([tabId, msg.step.id]), { ok: true });
    await load();
    await r.resumeRun();
    expect((await until('done')).status).toEqual(['done', 'done']);
    expect(played.map(([, id]) => id)).toEqual(['a', 'b']);
  });

  it('asks for a password, types it once, and never saves it', async () => {
    const pw: Step = { id: 'pw', label: 'Type password in "Password"', locators: [], action: 'type', value: '', secret: true };
    await save([pw, click('b')]);
    const values: unknown[] = [];
    page = (_, msg) => (msg.type === 'play' && values.push(msg.value), { ok: true });
    await r.play('m', 1);
    expect((await until('waiting')).message).toBe("Step 1: type the password for **Password**. It's used once and never saved.");

    await r.proceed('hunter2');
    await until('done');
    expect(values).toEqual(['hunter2', undefined]);
    expect(JSON.stringify(await fakeBrowser.storage.session.get())).not.toContain('hunter2');
  });

  it('waits for the user to choose a file, and skips a failing step', async () => {
    const file: Step = { id: 'f', label: 'Upload a file to "Resume"', locators: [], action: 'upload' };
    await save([file, click('bad'), click('c')]);
    page = (_, msg) => (msg.type === 'play' && msg.step.id === 'bad' ? { error: 'missing' } : { ok: true });
    await r.play('m', 1);
    expect((await until('waiting')).message).toContain('choose the file for **Resume**');
    await r.proceed();
    await until('failed');
    await r.skip();
    expect((await until('done')).status).toEqual(['done', 'skipped', 'done']);
  });

  it('saves the element the user picks for a failing step and retries it', async () => {
    await save([{ ...click('a'), locators: [{ kind: 'id', value: 'old' }], scope: [[{ kind: 'id', value: 'host' }]] }]);
    const target = { locators: [{ kind: 'id', value: 'new' }] };
    page = (_, msg) => (msg.type === 'pick' ? target : msg.type === 'play' && msg.step.locators[0]?.value === 'new' ? { ok: true } : { error: 'missing' });
    await r.play('m', 1);
    await until('failed');
    await r.pickAgain();
    await until('done');
    const { macros } = await import('../src/bg/state');
    expect((await macros.getValue())[0]!.steps[0]).toEqual({ ...click('a'), locators: target.locators });
  });

  it('does nothing more once stopped while waiting for a new tab or for the page', async () => {
    await save([click('a'), go('tab', 'https://a.io/report', true)]);
    await r.play('m', 1);
    await vi.waitFor(() => expect(played).toEqual([[1, 'a']]));
    await r.stopRun();
    await new Promise((res) => setTimeout(res, 300));
    expect(fakeBrowser.tabs.create).not.toHaveBeenCalled();

    await save([click('b')]);
    const send = vi.fn(async () => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.')));
    fakeBrowser.tabs.sendMessage = send as never;
    await r.play('m', 1);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    await r.stopRun();
    const calls = send.mock.calls.length;
    await new Promise((res) => setTimeout(res, 700));
    expect(send.mock.calls.length).toBe(calls);
  });

  it('ignores a late result from a step the user skipped', async () => {
    await save([click('a'), click('b')]);
    let finish!: (v: unknown) => void;
    page = (tabId, msg) => {
      if (msg.type !== 'play') return '';
      played.push([tabId, msg.step.id]);
      return msg.step.id === 'a' ? new Promise((res) => (finish = res)) : { ok: true };
    };
    await r.play('m', 1);
    await vi.waitFor(() => expect(played).toEqual([[1, 'a']]));
    await r.pause();
    await r.skip();
    finish({ error: 'missing' });
    expect(await until('done')).toMatchObject({ status: ['skipped', 'done'], message: '' });
    expect(played.map(([, id]) => id)).toEqual(['a', 'b']);
  });

  it("doesn't save a pick the user moved on from", async () => {
    await save([{ ...click('a'), locators: [{ kind: 'id', value: 'old' }] }]);
    let picked!: (v: unknown) => void;
    page = (_, msg) => (msg.type === 'pick' ? new Promise((res) => (picked = res)) : msg.type === 'play' ? { error: 'missing' } : '');
    await r.play('m', 1);
    await until('failed');
    void r.pickAgain();
    await until('picking');
    await r.resume();
    await until('failed');
    picked({ locators: [{ kind: 'id', value: 'new' }] });
    await new Promise((res) => setTimeout(res, 50));
    const { macros } = await import('../src/bg/state');
    expect((await macros.getValue())[0]!.steps[0]!.locators).toEqual([{ kind: 'id', value: 'old' }]);
    expect((await r.run.getValue())!.steps[0]!.locators).toEqual([{ kind: 'id', value: 'old' }]);
  });
});
