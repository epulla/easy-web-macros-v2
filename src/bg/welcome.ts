import type { Browser } from 'wxt/browser';

// v1 shipped as 0.0.x; updates within v2 open nothing.
export function welcomePage({ reason, previousVersion }: Browser.runtime.InstalledDetails): `/onboarding.html${string}` | null {
  if (reason === 'install') return '/onboarding.html';
  if (reason === 'update' && previousVersion?.startsWith('0.0.')) return '/onboarding.html#whats-new';
  return null;
}
