import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import type { Step } from '../core/macro';
import type { PageStep, PlayResult } from '../core/player';
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
  state: 'running' | 'paused' | 'failed' | 'done';
  message: string;
  delayMs: number;
  speed: number;
  round: number;
  runs: number;
  loop: boolean;
}

// Session storage keeps the run going across page loads and background restarts.
export const run = storage.defineItem<Run | null>('session:run', { fallback: null });

export type ToPage = { type: 'play'; step: PageStep; value?: string } | { type: 'where' };

const FOLLOW_MS = 10_000;
const LOAD_MS = 30_000;
const PAGE_NOT_READY = "This page isn't ready for playback.";
const NOT_LOADED = "The page didn't finish loading.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let queue: Promise<unknown> = Promise.resolve();
function update<T>(fn: (r: Run | null) => Promise<T> | T): Promise<T> {
  const next = queue.then(() => run.getValue().then(fn));
  queue = next.catch(() => {});
  return next;
}

// Only touches the run it was started for, so a stopped or replaced run stays untouched.
const patch = (id: string, fn: (r: Run) => Partial<Run>) =>
  update(async (r) => {
    if (r?.id !== id) return null;
    const next = { ...r, ...fn(r) };
    await run.setValue(next);
    return next;
  });

// Top-frame page loads, newest last; they tell navigate steps when a page is ready.
const pages: { tabId: number; opener?: number; at: number }[] = [];
export function pageLoaded(tabId: number, openerTabId?: number) {
  pages.push({ tabId, opener: openerTabId, at: Date.now() });
  if (pages.length > 50) pages.shift();
}

async function waitFor<T>(find: () => T | undefined, ms: number): Promise<T | undefined> {
  const deadline = Date.now() + ms;
  for (;;) {
    const found = find();
    if (found !== undefined || Date.now() >= deadline) return found;
    await sleep(100);
  }
}
const loadedSince = (tabId: number, at: number, ms: number) =>
  waitFor(() => pages.find((p) => p.tabId === tabId && p.at >= at), ms);

// Right after a page change the new page may not be listening yet.
async function sendToPage(tabId: number, msg: ToPage, ms = 15_000): Promise<unknown> {
  const deadline = Date.now() + ms;
  for (;;) {
    try {
      return await browser.tabs.sendMessage(tabId, msg, { frameId: 0 });
    } catch (e) {
      if (Date.now() >= deadline) throw e;
      await sleep(300);
    }
  }
}

// When the last page action happened, so a navigate step right after it waits for
// the page that action opened instead of loading the URL again.
let acted: { runId: string; index: number; at: number } | undefined;

type Outcome = PlayResult & { tabId?: number };

async function navigate(r: Run, step: Extract<Step, { action: 'navigate' }>): Promise<Outcome> {
  const after = acted?.runId === r.id && acted.index === r.index - 1 ? acted.at : undefined;
  if (step.newTab) {
    const opened =
      after === undefined
        ? undefined
        : await waitFor(() => pages.find((p) => p.at >= after && p.opener === r.tabId)?.tabId, FOLLOW_MS);
    if (opened !== undefined) return { ok: true, tabId: opened };
    const at = Date.now();
    const tab = await browser.tabs.create({ url: step.url, openerTabId: r.tabId });
    return tab.id !== undefined && (await loadedSince(tab.id, at, LOAD_MS)) ? { ok: true, tabId: tab.id } : { error: NOT_LOADED };
  }
  if (after !== undefined && (await loadedSince(r.tabId, after, FOLLOW_MS))) return { ok: true };
  if (after === undefined && (await sendToPage(r.tabId, { type: 'where' }, 0).catch(() => '')) === step.url) {
    return { ok: true };
  }
  const at = Date.now();
  await browser.tabs.update(r.tabId, { url: step.url });
  return (await loadedSince(r.tabId, at, LOAD_MS)) ? { ok: true } : { error: NOT_LOADED };
}

async function perform(r: Run): Promise<Outcome> {
  const step = r.steps[r.index]!;
  try {
    if (step.action === 'navigate') return await navigate(r, step);
    acted = { runId: r.id, index: r.index, at: Date.now() };
    return (await sendToPage(r.tabId, { type: 'play', step })) as PlayResult;
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
      await patch(r.id, (c) => ({ status: c.status.with(i, 'running') }));
      const res = await perform(r);
      const next = await patch(r.id, (c) =>
        'error' in res
          ? { status: c.status.with(i, 'failed'), state: 'failed', message: res.error }
          : { status: c.status.with(i, 'done'), index: i + 1, ...(res.tabId !== undefined && { tabId: res.tabId }) },
      );
      const more = next && (next.index < next.steps.length || next.loop || next.round < next.runs);
      if (next?.state === 'running' && more) await sleep(next.delayMs / next.speed);
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
  await update(() =>
    run.setValue({
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
    }),
  );
  void loop();
  return true;
}

export const pause = () =>
  update(async (r) => {
    if (r?.state === 'running') await run.setValue({ ...r, state: 'paused' });
  });

export async function resume() {
  await update(async (r) => {
    if (r?.state === 'paused' || r?.state === 'failed') await run.setValue({ ...r, state: 'running', message: '' });
  });
  void loop();
}

export const stopRun = () => update(() => run.setValue(null));
