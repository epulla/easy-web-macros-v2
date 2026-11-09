import { COUNT_CHANGED, DISABLED, HIDDEN, NOT_FOUND, waitForElement } from './locator';
import type { Step } from './macro';

export type PlayResult = { ok: true } | { error: string };
export type PageStep = Exclude<Step, { action: 'navigate' }>;

export const NO_OPTION = "This list doesn't have the recorded option anymore.";
export const PAGE_NOT_READY = "This page isn't ready for playback.";
export const NOT_LOADED = "The page didn't finish loading.";
export const ACTION_FAILED = "The page didn't accept the action.";
const CANCELLED = 'cancelled';

const NOUNS: Record<string, string> = {
  button: 'button',
  link: 'link',
  checkbox: 'checkbox',
  radio: 'option',
  textbox: 'field',
  searchbox: 'search field',
  combobox: 'list',
  heading: 'heading',
  img: 'image',
};

// "the **Submit** button", from what the user saw when recording.
export function describeTarget(step: Step): string {
  const role = step.locators.find((l) => l.kind === 'role')?.value;
  if (role) {
    const [kind, ...name] = role.split(' ');
    return `the **${name.join(' ')}**${NOUNS[kind!] ? ` ${NOUNS[kind!]}` : ''}`;
  }
  const label = step.locators.find((l) => l.kind === 'label' && /^(label|placeholder) /.test(l.value))?.value;
  if (label) return `the **${label.slice(label.indexOf(' ') + 1)}** field`;
  const text = step.locators.find((l) => l.kind === 'text')?.value;
  if (text) return `**${text.slice(text.indexOf(' ') + 1)}**`;
  const quoted = step.label.match(/"([^"]+)"/g)?.at(-1);
  return quoted ? `**${quoted.slice(1, -1)}**` : 'the item';
}

export function stepError(n: number, step: Step, reason: string): string {
  const what = describeTarget(step);
  const said: Record<string, string> = {
    [NOT_FOUND]: `couldn't find ${what} on this page.`,
    [HIDDEN]: `${what} is on the page but hidden.`,
    [DISABLED]: `${what} is turned off right now, so it can't be used.`,
    [COUNT_CHANGED]: `the page has a different number of sections than when you recorded, so I can't tell which ${what.replace(/^the /, '')} to use.`,
    [NO_OPTION]: `${what} doesn't have the option you picked anymore.`,
    [PAGE_NOT_READY]: 'this page isn\'t ready for playback. Reload the page, then press Try again.',
    [ACTION_FAILED]: `couldn't use ${what}; the page didn't accept the action. Press Try again, or pick it on the page.`,
    [NOT_LOADED]: "the page didn't finish loading. Check your connection, then press Try again.",
  };
  return `Step ${n}: ${said[reason] ?? reason}`;
}

function mouse(el: Element, type: string, detail = 1) {
  const win = el.ownerDocument.defaultView!;
  const Ctor = type.startsWith('pointer') ? (win.PointerEvent ?? win.MouseEvent) : win.MouseEvent;
  el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, composed: true, detail }));
}

function press(el: Element, detail = 1) {
  mouse(el, 'pointerdown', detail);
  mouse(el, 'mousedown', detail);
  (el as HTMLElement).focus?.();
  mouse(el, 'pointerup', detail);
  mouse(el, 'mouseup', detail);
  // click() runs default actions (toggle, follow link) the same way a real click does.
  if (el instanceof el.ownerDocument.defaultView!.HTMLElement) el.click();
  else mouse(el, 'click', detail);
}

// Goes through the native setter so frameworks that track the value (React) see the change.
function setValue(el: Element, value: string) {
  const win = el.ownerDocument.defaultView!;
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set?.call(el, value);
  el.dispatchEvent(new win.Event('input', { bubbles: true, composed: true }));
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
}

function key(el: Element, combo: string) {
  const win = el.ownerDocument.defaultView!;
  const parts = combo.split('+');
  const k = parts.at(-1)!;
  const init: KeyboardEventInit = {
    key: k.length === 1 && !parts.includes('Shift') ? k.toLowerCase() : k,
    ctrlKey: parts.includes('Control'),
    metaKey: parts.includes('Meta'),
    altKey: parts.includes('Alt'),
    shiftKey: parts.includes('Shift'),
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  const go = el.dispatchEvent(new win.KeyboardEvent('keydown', init));
  el.dispatchEvent(new win.KeyboardEvent('keyup', init));
  // A synthetic Enter doesn't submit forms on its own.
  if (go && combo === 'Enter' && el.matches('input')) (el as HTMLInputElement).form?.requestSubmit();
}

function act(el: Element, step: PageStep, value?: string) {
  if (step.action !== 'hover') el.scrollIntoView?.({ block: 'center' });
  switch (step.action) {
    case 'click':
      return press(el);
    case 'dblclick':
      press(el, 1);
      press(el, 2);
      return mouse(el, 'dblclick', 2);
    case 'hover':
      for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove']) mouse(el, type);
      return;
    case 'scroll':
      return;
    case 'type': {
      const text = value ?? step.value;
      (el as HTMLElement).focus?.();
      if ((el as HTMLElement).isContentEditable) {
        el.textContent = text;
        el.dispatchEvent(new (el.ownerDocument.defaultView!.Event)('input', { bubbles: true, composed: true }));
      } else setValue(el, text);
      return;
    }
    case 'select':
      return setValue(el, step.value);
    case 'check': {
      const on = 'checked' in el ? (el as HTMLInputElement).checked : el.getAttribute('aria-checked') === 'true';
      if (on !== step.checked) press(el);
      return;
    }
    case 'key':
      (el as HTMLElement).focus?.();
      return key(el, step.key);
    case 'upload':
      (el as HTMLElement).focus?.();
      return;
  }
}

// A click that leaves the page can drop the reply; the background counts that as done.
export async function play(step: PageStep, value?: string, signal?: AbortSignal, doc = document): Promise<PlayResult> {
  const aborted = new Promise<never>((_, reject) => signal?.addEventListener('abort', () => reject(new Error(CANCELLED))));
  aborted.catch(() => {});
  let el: Element;
  try {
    el = await Promise.race([waitForElement(step, { doc }), aborted]);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (step.action === 'select' && ![...(el as HTMLSelectElement).options].some((o) => o.value === step.value)) {
    return { error: NO_OPTION };
  }
  try {
    act(el, step, value);
  } catch {
    return { error: ACTION_FAILED };
  }
  return { ok: true };
}
