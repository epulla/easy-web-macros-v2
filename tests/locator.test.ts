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
  ])('fails after the timeout when %s', async (_, change, message) => {
    const locators = captureLocators($('#submit-btn'));
    change($('#submit-btn') as HTMLButtonElement);
    await expect(waitForElement(locators, { timeoutMs: 200 })).rejects.toThrow(message);
  });
});
