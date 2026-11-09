// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyOp, record, type RecordOp } from '../src/core/recorder';
import type { Step } from '../src/core/macro';

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
let ops: RecordOp[];
let stop: () => void;
const steps = () => ops.reduce<Step[]>(applyOp, []);
const brief = () => steps().map(({ id, locators, scope, ...rest }) => rest);
const start = (opts?: { hover?: boolean }) => (stop = record(document, (op) => ops.push(op), opts));

const click = (el: Element, detail = 1) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
const typeInto = (el: HTMLInputElement, text: string) => {
  for (const ch of text) {
    el.value += ch;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
};
const key = (el: Element, key: string, mods: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }));
const input = (el: Element) => el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

beforeEach(() => {
  ops = [];
  document.body.innerHTML = `
    <form>
      <label for="email">Email</label><input id="email" />
      <label><input id="agree" type="checkbox" /> I agree</label>
      <input id="plan-a" type="radio" name="plan" aria-label="Plan A" />
      <select id="country" aria-label="Country"><option value="ec">Ecuador</option><option value="pe">Peru</option></select>
      <input id="cv" type="file" aria-label="Resume" />
      <button id="go" type="button">Sign in</button>
    </form>
    <div id="card">Card</div>`;
});
afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe('record', () => {
  it('records a click with locators and a plain label', () => {
    start();
    click($('#go'));
    expect(steps()).toEqual([expect.objectContaining({ action: 'click', label: 'Click "Sign in"' })]);
    expect(steps()[0]!.locators[0]).toEqual({ kind: 'id', value: 'go' });
  });

  it('turns two clicks plus dblclick into one double-click step', () => {
    start();
    click($('#card'));
    click($('#card'), 2);
    $('#card').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(brief()).toEqual([{ action: 'dblclick', label: 'Double-click "Card"' }]);
  });

  it('keeps typing in one field as one step with the final value', () => {
    start();
    typeInto($('#email'), 'ana@x.io');
    expect(brief()).toEqual([{ action: 'type', label: 'Type in "Email"', value: 'ana@x.io', secret: false }]);
  });

  it.each([
    ['password field', '<input id="pw" type="password" aria-label="Password" />'],
    ['shown password', '<input id="pw" type="text" autocomplete="current-password" aria-label="Password" />'],
  ])('never stores what is typed in a %s', (_, html) => {
    document.body.innerHTML = html;
    start();
    typeInto($('#pw'), 'hunter2');
    expect(brief()).toEqual([{ action: 'type', label: 'Type password in "Password"', value: '', secret: true }]);
    expect(JSON.stringify(ops)).not.toContain('hunter');
  });

  it('keeps hiding a password after "show password" turns the field into text', () => {
    document.body.innerHTML = '<input id="pw" type="password" aria-label="Password" />';
    start();
    typeInto($('#pw'), 'hunter');
    $<HTMLInputElement>('#pw').type = 'text';
    typeInto($('#pw'), '2');
    expect(brief()).toEqual([{ action: 'type', label: 'Type password in "Password"', value: '', secret: true }]);
    expect(JSON.stringify(ops)).not.toContain('hunter');
  });

  it('keeps hiding a prefilled password revealed before it was touched', async () => {
    document.body.innerHTML = '<input id="pw" type="password" aria-label="Password" value="hunter" />';
    start();
    $<HTMLInputElement>('#pw').type = 'text';
    await Promise.resolve();
    typeInto($('#pw'), '2');
    expect(brief()).toEqual([{ action: 'type', label: 'Type password in "Password"', value: '', secret: true }]);
    expect(JSON.stringify(ops)).not.toContain('hunter');
  });

  it('records a choice inside a shadow root', () => {
    const host = document.createElement('div');
    document.body.append(host);
    host.attachShadow({ mode: 'open' }).innerHTML = '<select aria-label="Size"><option value="s">Small</option><option value="l">Large</option></select>';
    const select = host.shadowRoot!.querySelector('select')!;
    start();
    select.value = 'l';
    input(select);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(brief()).toEqual([{ action: 'select', label: 'Choose "Large" in "Size"', value: 'l' }]);
  });

  it('starts a new type step after another action', () => {
    start();
    typeInto($('#email'), 'a');
    click($('#go'));
    typeInto($('#email'), 'b');
    expect(brief().map((s) => s.action)).toEqual(['type', 'click', 'type']);
  });

  it('records a select choice', () => {
    start();
    $<HTMLSelectElement>('#country').value = 'pe';
    input($('#country'));
    expect(brief()).toEqual([{ action: 'select', label: 'Choose "Peru" in "Country"', value: 'pe' }]);
  });

  it('records checkbox and radio changes, not the clicks behind them', () => {
    start();
    // jsdom, like Chrome, forwards the label click to the box, which toggles it and fires input.
    click($('label:has(#agree)'));
    click($('#plan-a'));
    expect(brief()).toEqual([
      { action: 'check', label: 'Check "I agree"', checked: true },
      { action: 'check', label: 'Pick "Plan A"', checked: true },
    ]);
  });

  it.each([
    ['Enter', {}, 'Enter'],
    ['Tab', { shiftKey: true }, 'Shift+Tab'],
    ['Escape', {}, 'Escape'],
    ['s', { ctrlKey: true }, 'Control+S'],
  ])('records the %s key', (k, mods, expected) => {
    start();
    key($('#email'), k, mods);
    expect(brief()).toEqual([{ action: 'key', label: `Press ${expected}`, key: expected }]);
  });

  it('ignores plain typing keys, Enter on a button, and the submit click Enter causes', () => {
    start();
    key($('#email'), 'a');
    key($('#email'), 'Shift');
    key($('#go'), 'Enter');
    key($('#email'), 'Enter');
    click($('#go'), 0);
    expect(brief().map((s) => s.action)).toEqual(['key']);
  });

  it('records one scroll step for the element in view after scrolling stops', () => {
    vi.useFakeTimers();
    document.elementFromPoint = () => $('#card');
    start();
    document.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(300);
    document.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(500);
    document.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(500);
    expect(brief()).toEqual([{ action: 'scroll', label: 'Scroll to "Card"' }]);
  });

  it('records hover only when turned on, and drops it when the same element is clicked', () => {
    vi.useFakeTimers();
    const rest = (el: Element) => {
      el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      vi.advanceTimersByTime(1000);
    };
    start();
    rest($('#card'));
    expect(steps()).toEqual([]);
    stop();

    start({ hover: true });
    rest($('#card'));
    expect(brief()).toEqual([{ action: 'hover', label: 'Hover over "Card"' }]);
    click($('#card'));
    expect(brief().map((s) => s.action)).toEqual(['click']);
  });

  it('records a file upload as a placeholder step', () => {
    start();
    click($('#cv'));
    input($('#cv'));
    expect(brief()).toEqual([{ action: 'upload', label: 'Upload a file to "Resume"' }]);
  });

  it('stops recording', () => {
    start();
    stop();
    click($('#go'));
    expect(steps()).toEqual([]);
  });
});
