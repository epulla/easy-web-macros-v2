import { storage } from 'wxt/utils/storage';
import { migrate, type Macro, type V1Collection } from '../core/macro';

// First run after a v1 update builds macros from v1 `collections`, which stays untouched.
export const macros = storage.defineItem<Macro[]>('local:macros', {
  version: 2,
  init: async () => migrate((await storage.getItem<Record<string, V1Collection>>('local:collections')) ?? {}),
});
