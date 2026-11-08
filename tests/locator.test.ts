// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { captureLocators, waitForElement } from '../src/core/locator';
import html from './fixtures/form.html?raw';

const $ = (s: string) => document.querySelector(s)!;

// jsdom has no layout; Chrome's checkVisibility is approximated by the `hidden` attribute.
Element.prototype.checkVisibility = function (this: Element) {
  return !this.closest('[hidden]');
};

beforeEach(() => {
  document.body.innerHTML = html;
});

describe('captureLocators', () => {
  it('ranks test id, id, role, text, css and xpath for a button', () => {
    expect(captureLocators($('[data-testid=login-submit]'))).toEqual([
      { kind: 'testId', value: '[data-testid="login-submit"]' },
      { kind: 'id', value: 'submit-btn' },
      { kind: 'role', value: 'button Sign in' },
      { kind: 'text', value: 'button Sign in' },
      { kind: 'css', value: '[id="login"] > button:nth-of-type(1)' },
      { kind: 'xpath', value: '/html/body/main/form/button[1]' },
    ]);
  });

  it('captures label, name and placeholder for an input', () => {
    expect(captureLocators($('#email'))).toEqual([
      { kind: 'id', value: 'email' },
      { kind: 'role', value: 'textbox Email address' },
      { kind: 'label', value: 'label Email address' },
      { kind: 'label', value: 'name email' },
      { kind: 'label', value: 'placeholder you@example.com' },
      { kind: 'css', value: '[id="login"] > input:nth-of-type(1)' },
      { kind: 'xpath', value: '/html/body/main/form/input[1]' },
    ]);
  });

  it('skips generated ids and uses aria-label as the name', () => {
    const locators = captureLocators($('[name=password]'));
    expect(locators.map((l) => l.kind)).not.toContain('id');
    expect(locators).toContainEqual({ kind: 'role', value: 'textbox Password' });
  });

  it('captures other stable data attributes but skips hashed ones', () => {
    document.body.innerHTML = '<button data-action="save" data-v-7ba5bd90="">Save</button>';
    expect(captureLocators($('button'))[0]).toEqual({ kind: 'testId', value: '[data-action="save"]' });
  });

  it('drops locators that match more than one element', () => {
    const locators = captureLocators($('div > span'));
    expect(locators.map((l) => l.kind)).toEqual(['css', 'xpath']);
  });
});

describe('waitForElement', () => {
  it('still finds the button after its id, class and test id change', async () => {
    const locators = captureLocators($('#submit-btn'));
    const button = $('#submit-btn');
    button.id = 'new-id';
    button.className = 'x';
    button.removeAttribute('data-testid');
    await expect(waitForElement(locators, { timeoutMs: 0 })).resolves.toBe(button);
  });

  it('still finds the button after its text and id change if a data attribute stays', async () => {
    document.body.innerHTML = '<button id="a" data-action="save">Save</button>';
    const locators = captureLocators($('button'));
    $('button').textContent = 'Store';
    $('button').id = 'b';
    await expect(waitForElement(locators, { timeoutMs: 0 })).resolves.toBe($('button'));
  });

  it('ignores hidden text when matching by name', async () => {
    document.body.innerHTML = '<p><button>Save <span hidden>old</span></button></p>';
    const locators = captureLocators($('button'));
    expect(locators).toContainEqual({ kind: 'role', value: 'button Save' });
    $('span').textContent = 'new';
    await expect(waitForElement(locators, { timeoutMs: 0 })).resolves.toBe($('button'));
  });

  it('waits while a parent marks the element disabled', async () => {
    const locators = captureLocators($('#submit-btn'));
    $('form').setAttribute('aria-disabled', 'true');
    setTimeout(() => $('form').removeAttribute('aria-disabled'), 150);
    await expect(waitForElement(locators, { timeoutMs: 1000 })).resolves.toBe($('#submit-btn'));
  });

  it('uses an xpath when it is the only locator (migrated v1 step)', async () => {
    const locators = [{ kind: 'xpath' as const, value: '/html/body/main/a' }];
    await expect(waitForElement(locators, { timeoutMs: 0 })).resolves.toBe($('a'));
  });

  it('waits for an element that appears and becomes enabled later', async () => {
    const locators = captureLocators($('#submit-btn'));
    const button = $('#submit-btn') as HTMLButtonElement;
    button.remove();
    setTimeout(() => {
      button.disabled = true;
      $('form').append(button);
    }, 150);
    setTimeout(() => (button.disabled = false), 300);
    await expect(waitForElement(locators, { timeoutMs: 1000 })).resolves.toBe(button);
  });

  it.each([
    ['missing', (b: HTMLButtonElement) => b.remove(), "Couldn't find this element on the page."],
    ['hidden', (b: HTMLButtonElement) => (b.hidden = true), 'This element is hidden.'],
    ['disabled', (b: HTMLButtonElement) => (b.disabled = true), 'This element is turned off (disabled).'],
    ['disabled by a shadow host', (b: HTMLButtonElement) => {
      const host = document.createElement('div');
      host.setAttribute('aria-disabled', 'true');
      host.attachShadow({ mode: 'open' }).append(b);
      document.body.append(host);
    }, 'This element is turned off (disabled).'],
  ])('fails after the timeout when %s', async (_, change, message) => {
    const locators = captureLocators($('#submit-btn'));
    change($('#submit-btn') as HTMLButtonElement);
    await expect(waitForElement(locators, { timeoutMs: 200 })).rejects.toThrow(message);
  });
});

describe('frames and shadow DOM', () => {
  it('captures and finds a button inside an open shadow root', async () => {
    const host = document.createElement('x-widget');
    host.attachShadow({ mode: 'open' }).innerHTML = '<div><button id="go">Go</button></div>';
    document.body.append(host);
    const button = host.shadowRoot!.querySelector('button')!;

    const locators = captureLocators(button);
    expect(locators.map((l) => l.kind)).not.toContain('xpath');
    button.id = 'changed';
    await expect(waitForElement(locators, { timeoutMs: 0 })).resolves.toBe(button);
  });

  it('captures and finds an input inside a same-origin iframe', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    (frame.contentWindow as typeof window).Element.prototype.checkVisibility = Element.prototype.checkVisibility;
    frame.contentDocument!.body.innerHTML = '<label>City <input id="city"></label>';
    const input = frame.contentDocument!.querySelector('input')!;

    const locators = captureLocators(input);
    expect(locators).toContainEqual({ kind: 'label', value: 'label City' });
    input.id = 'changed';
    await expect(waitForElement(locators, { timeoutMs: 0 })).resolves.toBe(input);
  });
});
