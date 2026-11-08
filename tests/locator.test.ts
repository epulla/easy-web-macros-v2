// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { captureLocators } from '../src/core/locator';
import html from './fixtures/form.html?raw';

const $ = (s: string) => document.querySelector(s)!;

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
