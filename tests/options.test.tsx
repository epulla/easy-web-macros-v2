// @vitest-environment jsdom
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { ToBackground } from '../entrypoints/background';
import type { Macro, Step } from '../src/core/macro';

const click = (id: string): Step => ({ id, label: `Click ${id}`, locators: [{ kind: 'text', value: id }], action: 'click' });
const macro = (id: string, steps: Step[] = []): Macro => ({ id, name: `Macro ${id}`, steps, delayMs: 0, runs: 1, loop: false });
const button = (name: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));

beforeEach(async () => {
  fakeBrowser.reset();
  vi.resetModules();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('confirm', () => true);
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0));
  const state = await import('../src/bg/state');
  fakeBrowser.runtime.sendMessage = (async (msg: ToBackground) =>
    msg.type === 'edit-macro' ? state.editMacro(msg.id, msg.edit) : msg.type === 'delete-macro' ? state.deleteMacro(msg.id) : undefined) as never;
  await state.macros.setValue([macro('m', [click('a'), click('b')]), macro('n')]);
  document.body.innerHTML = '<div id="root"></div>';
  history.replaceState(null, '', '#m');
  await act(() => import('../entrypoints/options/main'));
  await settle();
});

describe('options editor', () => {
  it('shows the saved order after several moves with slow saves, plus changes made elsewhere', async () => {
    const state = await import('../src/bg/state');
    const fast = fakeBrowser.runtime.sendMessage;
    // The save lands right away but its reply comes late, so later saves land before earlier replies.
    fakeBrowser.runtime.sendMessage = (async (msg: ToBackground) => (await fast(msg), await new Promise((r) => setTimeout(r, 50)))) as never;
    await state.macros.setValue([macro('m', ['a', 'b', 'c', 'd'].map(click)), macro('n')]);
    await act(() => new Promise((r) => setTimeout(r, 20)));
    for (const name of ['Move step 2 down', 'Move step 2 up', 'Move step 2 down', 'Move step 4 up']) {
      await act(async () => button(name).click());
    }
    await state.updateMacros((ms) => ms.map((m) => ({ ...m, name: m.id === 'm' ? 'Renamed elsewhere' : m.name })));
    await act(() => new Promise((r) => setTimeout(r, 200)));

    const saved = (await state.macros.getValue())[0]!;
    expect(saved.steps.map((s) => s.id)).toEqual(['c', 'b', 'd', 'a']);
    expect([...document.querySelectorAll('.track-label')].map((el) => el.textContent)).toEqual(['Click c', 'Click b', 'Click d', 'Click a']);
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Macro name"]')!.value).toBe('Renamed elsewhere');
  });

  it('moves focus to the next step after deleting the focused one', async () => {
    button('Delete step 1').focus();
    await act(async () => button('Delete step 1').click());
    await settle();
    expect(document.activeElement).toBe(button('Edit step 1'));
    expect(document.querySelectorAll('.track-label')).toHaveLength(1);
  });

  it('moves focus to the next way after removing a way to find a step', async () => {
    await act(async () => button('Edit step 1').click());
    await act(async () => document.querySelector<HTMLButtonElement>('button[id^="loc-add-"]')!.click());
    await act(async () => button('Remove way 1').click());
    await settle();
    expect(document.activeElement).toBe(button('Remove way 1'));
  });

  it('moves focus to the remaining macro after deleting one', async () => {
    const del = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Delete this macro')!;
    await act(async () => del.click());
    await settle();
    expect(document.activeElement?.id).toBe('macro-n');
    const { macros } = await import('../src/bg/state');
    expect((await macros.getValue()).map((m) => m.id)).toEqual(['n']);
  });
});
