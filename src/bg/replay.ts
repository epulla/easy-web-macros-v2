import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import type { Target } from '../core/locator';
import type { Step } from '../core/macro';
import { describeTarget, NOT_LOADED, PAGE_NOT_READY, stepError, type PageStep, type PlayResult } from '../core/player';
import { macros } from './state';

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface Run {
  id: string;
  macroId: string;
  name: string;
  steps: Step[];
  status: StepStatus[];
  index: number;
  tabId: number;
  // waiting: the user has to type a password or choose a file; picking: the user is
  // clicking the right element for a failed step.
  state: 'running' | 'paused' | 'failed' | 'waiting' | 'picking' | 'done';
  message: string;
  delayMs: number;
  speed: number;
  round: number;
  runs: number;
  loop: boolean;
}

// Session storage keeps the run going across page loads and background restarts.
export const run = storage.defineItem<Run | null>('session:run', { fallback: null });

export type ToPage =
  | { type: 'play'; step: PageStep; value?: string }
  | { type: 'where' }
  | { type: 'pick' }
  | { type: 'cancel' };

const FOLLOW_MS = 10_000;
const LOAD_MS = 30_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Bumped whenever the user changes course (new run, stop, skip, retry), so work started
// before that stops waiting and can't act or report anymore.
let gen = 0;
function cancel(r: Run | null) {
  gen++;
  if (r) void browser.tabs.sendMessage(r.tabId, { type: 'cancel' } satisfies ToPage).catch(() => {});
}
const CANCELLED = { error: 'cancelled' } as const;

let queue: Promise<unknown> = Promise.resolve();
function update<T>(fn: (r: Run | null) => Promise<T> | T): Promise<T> {
  const next = queue.then(() => run.getValue().then(fn));
  queue = next.catch(() => {});
  return next;
}

// Only touches the run it was started for, so a stopped or replaced run stays untouched.
const patch = (id: string, fn: (r: Run) => Partial<Run> | null) =>
  update(async (r) => {
    const changes = r?.id === id ? fn(r) : null;
    if (!r || !changes) return null;
    const next = { ...r, ...changes };
    await run.setValue(next);
    return next;
  });

// Top-frame page loads, newest last; they tell navigate steps when a page is ready.
const pages: { tabId: number; opener?: number; at: number }[] = [];
export function pageLoaded(tabId: number, openerTabId?: number) {
  pages.push({ tabId, opener: openerTabId, at: Date.now() });
  if (pages.length > 50) pages.shift();
}

async function waitFor<T>(g: number, find: () => T | undefined, ms: number): Promise<T | undefined> {
  const deadline = Date.now() + ms;
  for (;;) {
    const found = find();
    if (found !== undefined || gen !== g || Date.now() >= deadline) return found;
    await sleep(100);
  }
}
const loadedSince = (g: number, tabId: number, at: number, ms: number) =>
  waitFor(g, () => pages.find((p) => p.tabId === tabId && p.at >= at), ms);

const NO_RECEIVER = /Receiving end does not exist|Could not establish connection/;

// Right after a page change the new page may not be listening yet. Any other failure
// means the page went away after getting the message (e.g. the click left the page).
async function sendToPage(g: number, tabId: number, msg: ToPage, ms = 15_000): Promise<unknown> {
  const deadline = Date.now() + ms;
  for (;;) {
    if (gen !== g) return CANCELLED;
    try {
      return await browser.tabs.sendMessage(tabId, msg, { frameId: 0 });
    } catch (e) {
      if (!NO_RECEIVER.test(String(e))) return { ok: true };
      if (Date.now() >= deadline) throw e;
      await sleep(300);
    }
  }
}

// When the last page action happened, so a navigate step right after it waits for
// the page that action opened instead of loading the URL again.
let acted: { runId: string; index: number; at: number } | undefined;

type Outcome = ({ ok: true; tabId?: number } | { error: string } | { ask: string });

// A password typed for the current step; kept in memory only, never saved.
let given: { runId: string; index: number; value: string } | undefined;

async function navigate(g: number, r: Run, step: Extract<Step, { action: 'navigate' }>): Promise<Outcome> {
  const after = acted?.runId === r.id && acted.index === r.index - 1 ? acted.at : undefined;
  if (step.newTab) {
    const opened =
      after === undefined
        ? undefined
        : await waitFor(g, () => pages.find((p) => p.at >= after && p.opener === r.tabId)?.tabId, FOLLOW_MS);
    if (opened !== undefined) return { ok: true, tabId: opened };
    if (gen !== g) return CANCELLED;
    const at = Date.now();
    const tab = await browser.tabs.create({ url: step.url, openerTabId: r.tabId });
    return tab.id !== undefined && (await loadedSince(g, tab.id, at, LOAD_MS)) ? { ok: true, tabId: tab.id } : { error: NOT_LOADED };
  }
  if (after !== undefined && (await loadedSince(g, r.tabId, after, FOLLOW_MS))) return { ok: true };
  if (after === undefined && (await sendToPage(g, r.tabId, { type: 'where' }, 0).catch(() => '')) === step.url) {
    return { ok: true };
  }
  if (gen !== g) return CANCELLED;
  const at = Date.now();
  await browser.tabs.update(r.tabId, { url: step.url });
  return (await loadedSince(g, r.tabId, at, LOAD_MS)) ? { ok: true } : { error: NOT_LOADED };
}

async function perform(g: number, r: Run): Promise<Outcome> {
  const step = r.steps[r.index]!;
  try {
    if (step.action === 'navigate') return await navigate(g, r, step);
    const n = r.index + 1;
    let value: string | undefined;
    if (step.action === 'type' && step.secret) {
      if (given?.runId !== r.id || given.index !== r.index) {
        return { ask: `Step ${n}: type the password for ${describeTarget(step)}. It's used once and never saved.` };
      }
      value = given.value;
      given = undefined;
    }
    acted = { runId: r.id, index: r.index, at: Date.now() };
    const res = (await sendToPage(g, r.tabId, { type: 'play', step, value })) as PlayResult;
    if (step.action === 'upload' && 'ok' in res) {
      return { ask: `Step ${n}: choose the file for ${describeTarget(step)} on the page, then press Continue.` };
    }
    return res;
  } catch {
    return { error: PAGE_NOT_READY };
  }
}

let looping = false;
async function loop(): Promise<void> {
  if (looping) return;
  looping = true;
  try {
    for (let r = await run.getValue(); r?.state === 'running'; r = await run.getValue()) {
      if (r.index >= r.steps.length) {
        await patch(r.id, (c) =>
          c.loop || c.round < c.runs
            ? { round: c.round + 1, index: 0, status: c.steps.map(() => 'pending') }
            : { state: 'done' },
        );
        continue;
      }
      const i = r.index;
      const g = gen;
      await patch(r.id, (c) => ({ status: c.status.with(i, 'running') }));
      const res = await perform(g, r);
      const next = await patch(r.id, (c) =>
        gen !== g
          ? null
          : 'error' in res
          ? { status: c.status.with(i, 'failed'), state: 'failed', message: stepError(i + 1, c.steps[i]!, res.error) }
          : 'ask' in res
            ? { state: 'waiting', message: res.ask }
            : { status: c.status.with(i, 'done'), index: i + 1, ...(res.tabId !== undefined && { tabId: res.tabId }) },
      );
      const more = next && (next.index < next.steps.length || next.loop || next.round < next.runs);
      if (next?.state === 'running' && 'ok' in res && more) await sleep(next.delayMs / next.speed);
    }
  } finally {
    looping = false;
  }
  // A resume can land while the loop was finishing; pick it up.
  if ((await run.getValue())?.state === 'running') return loop();
}

export const resumeRun = loop;

// Returns false when the macro no longer exists.
export async function play(macroId: string, tabId: number, { from = 0, speed = 1 } = {}): Promise<boolean> {
  const macro = (await macros.getValue()).find((m) => m.id === macroId);
  if (!macro) return false;
  await update((old) => {
    cancel(old);
    return run.setValue({
      id: crypto.randomUUID(),
      macroId,
      name: macro.name,
      steps: macro.steps,
      status: macro.steps.map((_, i) => (i < from ? 'skipped' : 'pending')),
      index: from,
      tabId,
      state: 'running',
      message: '',
      delayMs: macro.delayMs,
      speed,
      round: 1,
      runs: macro.runs,
      loop: macro.loop,
    });
  });
  void loop();
  return true;
}

export const pause = () =>
  update(async (r) => {
    if (r?.state === 'running') await run.setValue({ ...r, state: 'paused' });
  });

// Continues after a pause, or retries the current step.
export async function resume() {
  await update(async (r) => {
    if (!r || !['paused', 'failed', 'picking'].includes(r.state)) return;
    // A paused step may still be finishing; let it count.
    if (r.state !== 'paused') cancel(r);
    await run.setValue({ ...r, state: 'running', message: '' });
  });
  void loop();
}

export async function skip() {
  await update(async (r) => {
    if (!r || r.state === 'running' || r.state === 'done') return;
    cancel(r);
    await run.setValue({ ...r, status: r.status.with(r.index, 'skipped'), index: r.index + 1, state: 'running', message: '' });
  });
  void loop();
}

// Answers a waiting step: the password to type, or nothing once the user chose a file.
export async function proceed(value = '') {
  await update(async (r) => {
    if (r?.state !== 'waiting') return;
    const step = r.steps[r.index]!;
    if (step.action === 'upload') {
      await run.setValue({ ...r, status: r.status.with(r.index, 'done'), index: r.index + 1, state: 'running', message: '' });
    } else {
      given = { runId: r.id, index: r.index, value };
      await run.setValue({ ...r, state: 'running', message: '' });
    }
  });
  void loop();
}

// Lets the user click the element a failed step should use, saves it to the macro, and retries.
export async function pickAgain() {
  const r = await update(async (r) => {
    if (r?.state !== 'failed' || r.steps[r.index]!.action === 'navigate') return null;
    const next = { ...r, state: 'picking' as const, message: 'Click the right item on the page.' };
    await run.setValue(next);
    return next;
  });
  if (!r) return;
  const g = gen;
  let target: Target;
  try {
    // Every frame listens; the one the user clicks in answers.
    target = (await browser.tabs.sendMessage(r.tabId, { type: 'pick' } satisfies ToPage)) as Target;
  } catch {
    await patch(r.id, (c) => (gen === g ? { state: 'failed', message: stepError(c.index + 1, c.steps[c.index]!, PAGE_NOT_READY) } : null));
    return;
  }
  const stepId = r.steps[r.index]!.id;
  const fix = (s: Step): Step => {
    if (s.id !== stepId) return s;
    const { scope: _, ...rest } = s;
    return { ...rest, ...target } as Step;
  };
  // Checked inside the queue, so a retry, skip or stop pressed meanwhile wins.
  const saved = await update(async (c) => {
    if (c?.id !== r.id || gen !== g) return false;
    cancel(c);
    await run.setValue({ ...c, steps: c.steps.map(fix), state: 'running', message: '' });
    await macros.setValue((await macros.getValue()).map((m) => (m.id === r.macroId ? { ...m, steps: m.steps.map(fix) } : m)));
    return true;
  });
  if (saved) void loop();
}

export const stopRun = () =>
  update(async (r) => {
    cancel(r);
    await run.setValue(null);
  });
