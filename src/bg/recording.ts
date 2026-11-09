import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { DEFAULTS, type Step } from '../core/macro';
import { applyOp, type RecordOp } from '../core/recorder';
import { macros } from './state';

export interface Recording {
  tabs: number[];
  steps: Step[];
  hover: boolean;
}

// Session storage outlives the background worker going to sleep, not the browser.
export const recording = storage.defineItem<Recording | null>('session:recording', { fallback: null });

export type ToContent = { type: 'start'; hover: boolean } | { type: 'stop' };

let queue: Promise<unknown> = Promise.resolve();
// Steps arrive faster than storage writes; apply them one at a time so none get lost.
function update<T>(fn: (r: Recording | null) => Promise<T> | T): Promise<T> {
  const next = queue.then(() => recording.getValue().then(fn));
  queue = next.catch(() => {});
  return next;
}

// Returns false when the page can't be recorded (browser pages, or opened before install).
export const startRecording = (tabId: number, hover = false) =>
  update(async (r) => {
    if (r) return true;
    await recording.setValue({ tabs: [tabId], steps: [], hover });
    try {
      await browser.tabs.sendMessage(tabId, { type: 'start', hover } satisfies ToContent);
      return true;
    } catch {
      await recording.setValue(null);
      return false;
    }
  });

export const stopRecording = () =>
  update(async (r) => {
    if (!r) return;
    await recording.setValue(null);
    for (const tab of r.tabs) browser.tabs.sendMessage(tab, { type: 'stop' } satisfies ToContent).catch(() => {});
    if (!r.steps.length) return;
    const name = `New macro ${new Date().toLocaleString()}`;
    await macros.setValue([...(await macros.getValue()), { id: crypto.randomUUID(), name, steps: r.steps, ...DEFAULTS }]);
  });

export const addOp = (tabId: number, op: RecordOp) =>
  update(async (r) => {
    if (r?.tabs.includes(tabId)) await recording.setValue({ ...r, steps: applyOp(r.steps, op) });
  });

// A page that just loaded asks whether to keep recording.
export const hello = (tabId: number) =>
  update((r) => (r?.tabs.includes(tabId) ? { hover: r.hover } : null));
