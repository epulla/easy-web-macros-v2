import { describe, expect, it } from 'vitest';
import { defaultName } from '../src/core/macro';

describe('defaultName', () => {
  it.each([
    ['https://www.example.com/login', 'Log in | Example Corp', 'Log in · example.com'],
    ['https://shop.example.com/', 'Weekly order — Shop', 'Weekly order · shop.example.com'],
    ['https://example.com/', '  Spaced \n  out  ', 'Spaced out · example.com'],
    ['https://example.com/', 'Example.com', 'example.com'],
    ['https://example.com/', '', 'example.com'],
    ['https://a.io/', 'x'.repeat(80), `${'x'.repeat(59)}… · a.io`],
    ['not a url', 'Dashboard', 'Dashboard'],
    ['not a url', '', undefined],
  ])('%s + %j → %j', (url, title, expected) => {
    expect(defaultName(url, title)).toBe(expected);
  });
});
