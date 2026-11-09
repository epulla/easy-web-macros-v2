import { storage } from 'wxt/utils/storage';
import { migrate, type Macro, type V1Collection } from '../core/macro';

// First run after a v1 update builds macros from v1 `collections`, which stays untouched.
export const macros = storage.defineItem<Macro[]>('local:macros', {
  version: 2,
  init: async () => migrate((await storage.getItem<Record<string, V1Collection>>('local:collections')) ?? {}),
});

// Playback speed multiplier chosen in the popup.
export const speed = storage.defineItem<number>('local:speed', { fallback: 1 });

// How each macro's latest playback ended, keyed by macro id; `step` is the 1-based step it stopped at.
export interface LastRun {
  ok: boolean;
  at: number;
  step?: number;
}
export const lastRuns = storage.defineItem<Record<string, LastRun>>('local:lastRuns', { fallback: {} });
