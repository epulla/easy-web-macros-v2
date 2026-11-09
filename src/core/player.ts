import { waitForElement } from './locator';
import type { Step } from './macro';

export type PlayResult = { ok: true } | { error: string };
export type PageStep = Exclude<Step, { action: 'navigate' }>;

const NO_OPTION = "This list doesn't have the recorded option anymore.";

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

// Answers before acting: a click that leaves the page would otherwise drop the reply.
export async function play(step: PageStep, value?: string, doc = document): Promise<PlayResult> {
  let el: Element;
  try {
    el = await waitForElement(step, { doc });
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (step.action === 'select' && ![...(el as HTMLSelectElement).options].some((o) => o.value === step.value)) {
    return { error: NO_OPTION };
  }
  setTimeout(() => {
    try {
      act(el, step, value);
    } catch {
      // The page changed under us; the next step reports what's missing.
    }
  });
  return { ok: true };
}
