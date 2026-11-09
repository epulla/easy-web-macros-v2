// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { COUNT_CHANGED, DISABLED, HIDDEN, NOT_FOUND } from '../src/core/locator';
import type { Step } from '../src/core/macro';
import { play, stepError, type PageStep } from '../src/core/player';

const base = { id: 's', label: 'Step' };
const tick = () => new Promise((r) => setTimeout(r));
const $ = <T extends Element>(s: string) => document.querySelector<T>(s)!;

beforeEach(() => {
  document.body.innerHTML = `
    <form><input id="email" /><input id="agree" type="checkbox" checked />
    <select id="plan"><option value="a">A</option><option value="b">B</option></select></form>`;
  Element.prototype.checkVisibility = () => true;
});

describe('play', () => {
  it('types, selects and checks through the events pages listen to', async () => {
    const events: string[] = [];
    document.addEventListener('input', (e) => events.push((e.target as Element).id));
    const steps: PageStep[] = [
      { ...base, locators: [{ kind: 'id', value: 'email' }], action: 'type', value: 'a@b.io', secret: false },
      { ...base, locators: [{ kind: 'id', value: 'plan' }], action: 'select', value: 'b' },
      { ...base, locators: [{ kind: 'id', value: 'agree' }], action: 'check', checked: true },
      { ...base, locators: [{ kind: 'id', value: 'agree' }], action: 'check', checked: false },
    ];
    for (const step of steps) {
      expect(await play(step)).toEqual({ ok: true });
      await tick();
    }
    expect([$<HTMLInputElement>('#email').value, $<HTMLSelectElement>('#plan').value, $<HTMLInputElement>('#agree').checked]).toEqual([
      'a@b.io',
      'b',
      false,
    ]);
    expect(events).toEqual(['email', 'plan', 'agree']);
  });

  it("reports a list option that's gone without changing the list", async () => {
    const step: PageStep = { ...base, locators: [{ kind: 'id', value: 'plan' }], action: 'select', value: 'z' };
    expect(await play(step)).toEqual({ error: expect.stringContaining('option') });
    expect($<HTMLSelectElement>('#plan').value).toBe('a');
  });
});

describe('stepError', () => {
  const submit: Step = { id: 's', label: 'Click "Submit"', locators: [{ kind: 'role', value: 'button Submit' }], action: 'click' };
  const email: Step = { id: 'e', label: 'Type in "Email"', locators: [{ kind: 'label', value: 'label Email' }], action: 'type', value: '', secret: false };
  const bare: Step = { id: 'b', label: 'Click "Next page"', locators: [{ kind: 'css', value: 'a' }], action: 'click' };
  it.each([
    [submit, NOT_FOUND, "Step 4: couldn't find the **Submit** button on this page."],
    [submit, HIDDEN, 'Step 4: the **Submit** button is on the page but hidden.'],
    [submit, DISABLED, "Step 4: the **Submit** button is turned off right now, so it can't be used."],
    [submit, COUNT_CHANGED, "Step 4: the page has a different number of sections than when you recorded, so I can't tell which **Submit** button to use."],
    [email, NOT_FOUND, "Step 4: couldn't find the **Email** field on this page."],
    [bare, NOT_FOUND, "Step 4: couldn't find **Next page** on this page."],
  ])('%#: explains the failure in plain words', (step, reason, text) => {
    expect(stepError(4, step, reason)).toBe(text);
  });
});
