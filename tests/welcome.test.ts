import { describe, expect, it } from 'vitest';
import { welcomePage } from '../src/bg/welcome';

describe('welcomePage', () => {
  it.each([
    [{ reason: 'install' }, '/onboarding.html'],
    [{ reason: 'update', previousVersion: '0.0.6' }, '/onboarding.html#whats-new'],
    [{ reason: 'update', previousVersion: '0.1.0' }, null],
    [{ reason: 'chrome_update' }, null],
  ])('%o opens %s', (details, page) => {
    expect(welcomePage(details as never)).toBe(page);
  });
});
