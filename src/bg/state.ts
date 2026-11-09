import { storage } from 'wxt/utils/storage';
import { migrate, type Macro, type V1Collection } from '../core/macro';

// First run after a v1 update builds macros from v1 `collections`, which stays untouched.
export const macros = storage.defineItem<Macro[]>('local:macros', {
  version: 2,
  init: async () => migrate((await storage.getItem<Record<string, V1Collection>>('local:collections')) ?? {}),
});

// Every macros write goes through here (the editor via background messages), one at a
// time on fresh data, so a recording, a repair and an edit never undo each other.
let queue: Promise<unknown> = Promise.resolve();
export function updateMacros(fn: (ms: Macro[]) => Macro[]): Promise<void> {
  const next = queue.then(async () => macros.setValue(fn(await macros.getValue())));
  queue = next.catch(() => {});
  return next;
}

// Replaces a macro the editor changed; a macro deleted meanwhile stays deleted.
export const saveMacro = (macro: Macro) => updateMacros((ms) => ms.map((m) => (m.id === macro.id ? macro : m)));
export const addMacro = (macro: Macro) => updateMacros((ms) => [...ms, macro]);
export const deleteMacro = (id: string) => updateMacros((ms) => ms.filter((m) => m.id !== id));

// Playback speed multiplier chosen in the popup.
export const speed = storage.defineItem<number>('local:speed', { fallback: 1 });

// How each macro's latest playback ended, keyed by macro id; `step` is the 1-based step it stopped at.
export interface LastRun {
  ok: boolean;
  at: number;
  step?: number;
}
export const lastRuns = storage.defineItem<Record<string, LastRun>>('local:lastRuns', { fallback: {} });
