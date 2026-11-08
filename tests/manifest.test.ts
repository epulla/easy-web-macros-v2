import { describe, expect, it } from 'vitest';
import config from '../wxt.config';
import pkg from '../package.json';

describe('extension manifest', () => {
  it('requests only storage permission', () => {
    expect((config.manifest as { permissions?: string[] }).permissions).toEqual(['storage']);
  });

  it('ships version 0.1.0 in manifest and package.json', () => {
    expect((config.manifest as { version?: string }).version).toBe('0.1.0');
    expect(pkg.version).toBe('0.1.0');
  });
});
