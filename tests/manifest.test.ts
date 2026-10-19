import { describe, expect, it } from 'vitest';
import config from '../wxt.config';

describe('extension manifest', () => {
  it('requests only storage permission', () => {
    expect((config.manifest as { permissions?: string[] }).permissions).toEqual(['storage']);
  });
});
