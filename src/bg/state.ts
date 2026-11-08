import { storage } from 'wxt/utils/storage';
import { migrate, type Macro, type V1Collection } from '../core/macro';

// Keeps v1's `collections` key so WXT runs the v1 → v2 migration on the existing value.
export const macros = storage.defineItem<Macro[]>('local:collections', {
  fallback: [],
  version: 2,
  migrations: { 2: (v1: Record<string, V1Collection>) => migrate(v1) },
});
