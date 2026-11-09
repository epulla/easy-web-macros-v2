import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { DEFAULTS, type Step } from '../core/macro';
import { applyOp, type RecordOp } from '../core/recorder';
import { updateMacros } from './state';

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
    // Save first: if saving fails, the recording stays so Stop can be tried again.
    if (r.steps.length) {
      const name = `New macro ${new Date().toLocaleString()}`;
      await updateMacros((ms) => [...ms, { id: crypto.randomUUID(), name, steps: r.steps, ...DEFAULTS }]);
    }
    await recording.setValue(null);
    for (const tab of r.tabs) browser.tabs.sendMessage(tab, { type: 'stop' } satisfies ToContent).catch(() => {});
  });

export const addOp = (tabId: number, op: RecordOp) =>
  update(async (r) => {
    if (r?.tabs.includes(tabId)) await recording.setValue({ ...r, steps: applyOp(r.steps, op) });
  });

// Back-to-back page loads (redirects, reloads) collapse into one step.
function visit(r: Recording, url: string, newTab: boolean): Recording {
  const last = r.steps.at(-1);
  const merge = last?.action === 'navigate' && !newTab;
  newTab ||= merge && last.newTab;
  const where = url.replace(/^https?:\/\//, '');
  const step: Step = {
    id: merge ? last.id : crypto.randomUUID(),
    label: newTab ? `Open ${where} in a new tab` : `Go to ${where}`,
    locators: [],
    action: 'navigate',
    url,
    newTab,
  };
  return { ...r, steps: applyOp(r.steps, { op: 'put', step }) };
}

export interface Page {
  url: string;
  top: boolean;
  openerTabId?: number;
}

// A page that just loaded asks whether to keep recording. Tabs opened from a
// recording tab join the recording.
export const hello = (tabId: number, { url, top, openerTabId }: Page) =>
  update(async (r) => {
    if (!r) return null;
    const joins = !r.tabs.includes(tabId);
    if (joins && (openerTabId === undefined || !r.tabs.includes(openerTabId))) return null;
    // Only the top frame adds the tab, so a frame loading first can't hide that it's a new tab.
    if (top) await recording.setValue(visit(joins ? { ...r, tabs: [...r.tabs, tabId] } : r, url, joins));
    return { hover: r.hover };
  });

// The page the recording starts on.
export const firstPage = (tabId: number, url: string) =>
  update(async (r) => {
    if (r?.tabs.includes(tabId)) await recording.setValue(visit(r, url, false));
  });
