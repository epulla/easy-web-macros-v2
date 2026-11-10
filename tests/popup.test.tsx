// @vitest-environment jsdom
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

const button = (name: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;

beforeEach(async () => {
  fakeBrowser.reset();
  vi.resetModules();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '<div id="root"></div>';
  await act(() => import('../entrypoints/popup/main'));
  await act(() => new Promise((r) => setTimeout(r, 20)));
});

describe('popup settings', () => {
  it('keeps keyboard focus when opening and closing settings', async () => {
    await act(async () => button('Settings').click());
    expect(document.activeElement).toBe(button('Back to your macros'));
    await act(async () => button('Back to your macros').click());
    expect(document.activeElement).toBe(button('Settings'));
  });
});
