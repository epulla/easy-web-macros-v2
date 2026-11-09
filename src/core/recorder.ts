import { captureTarget, nameOf } from './locator';
import type { Step } from './macro';

// `put` adds a step or replaces the one with the same id, so a step that keeps
// changing (typing) is already saved if the page unloads mid-way.
export type RecordOp = { op: 'put'; step: Step } | { op: 'drop'; id: string };

export function applyOp(steps: Step[], op: RecordOp): Step[] {
  if (op.op === 'drop') return steps.filter((s) => s.id !== op.id);
  const i = steps.findIndex((s) => s.id === op.step.id);
  return i < 0 ? [...steps, op.step] : steps.with(i, op.step);
}

type Fields<T = Step> = T extends unknown ? Omit<T, 'id' | 'locators' | 'scope'> : never;

const NOT_TEXT = ['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'hidden'];
const ACTIVATES = 'button,a[href],input[type=submit],input[type=button],input[type=reset],input[type=image],summary';
const MODIFIERS = ['Control', 'Shift', 'Alt', 'Meta'];
const NAMED_KEYS = ['Enter', 'Tab', 'Escape'];
const PASSWORD = 'input[type=password],input[autocomplete$=password]';

const isTextEntry = (el: Element) =>
  el.tagName === 'TEXTAREA' ||
  (el.tagName === 'INPUT' && !NOT_TEXT.includes((el as HTMLInputElement).type)) ||
  (el as HTMLElement).isContentEditable === true;

// These fire input/change events that record a better step than the click.
function changesValue(el: Element): boolean {
  if (isTextEntry(el) || el.closest('select') || el.matches('input[type=checkbox],input[type=radio],input[type=file]')) return true;
  const control = el.closest('label')?.control;
  return !!control && control !== el && changesValue(control);
}

function describe(el: Element): string {
  const name = (nameOf(el) || (el.textContent ?? '').replace(/\s+/g, ' ').trim()).slice(0, 40);
  if (name) return `"${name}"`;
  return el.matches('html,body') ? 'the page' : 'an item';
}

const targetOf = (e: Event) => {
  const node = e.composedPath()[0] as Node | undefined;
  return node?.nodeType === 1 ? (node as Element) : null;
};

export function record(doc: Document, emit: (op: RecordOp) => void, { hover = false } = {}): () => void {
  let last: { step: Step; el: Element; at: number } | null = null;
  let clicks: { id: string; el: Element }[] = [];
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;

  const put = (el: Element, fields: Fields) => {
    const merge =
      last?.step.action === fields.action &&
      (fields.action === 'scroll' || (last.el === el && (fields.action === 'type' || fields.action === 'select')));
    if (!merge && last?.step.action === 'hover' && last.el === el) emit({ op: 'drop', id: last.step.id });
    const target = merge && last!.el === el ? { locators: last!.step.locators, scope: last!.step.scope } : captureTarget(el);
    const step = { id: merge ? last!.step.id : crypto.randomUUID(), ...target, ...fields } as Step;
    if (!step.scope) delete step.scope;
    last = { step, el, at: Date.now() };
    emit({ op: 'put', step });
    return step;
  };

  const onClick = (e: MouseEvent) => {
    const el = targetOf(e);
    if (!el || changesValue(el)) return;
    // Enter in a form field also "clicks" the submit button; the key step covers it.
    if (e.detail === 0 && last?.step.action === 'key' && last.step.key === 'Enter' && Date.now() - last.at < 100) return;
    clicks = [...clicks.slice(-1), { id: put(el, { action: 'click', label: `Click ${describe(el)}` }).id, el }];
  };

  const onDblClick = (e: MouseEvent) => {
    const el = targetOf(e);
    if (!el || changesValue(el)) return;
    const [first, second] = clicks;
    clicks = [];
    if (first?.el === el && second?.el === el) {
      emit({ op: 'drop', id: second.id });
      const step = { ...(last!.step as Step), id: first.id, action: 'dblclick', label: `Double-click ${describe(el)}` } as Step;
      last = { step, el, at: Date.now() };
      emit({ op: 'put', step });
    } else {
      put(el, { action: 'dblclick', label: `Double-click ${describe(el)}` });
    }
  };

  // Fields that were ever password fields, so a "show password" toggle doesn't expose the value.
  const passwords = new WeakSet<Element>();
  const notePassword = (e: Event) => {
    const el = targetOf(e);
    if (el?.matches(PASSWORD)) passwords.add(el);
  };
  // Catches a toggle on a field the user never touched (e.g. filled in by the browser),
  // in the page and in every open shadow root, which a document observer doesn't see.
  const watched = new WeakSet<Node>();
  const scan = (node: Element | Document | ShadowRoot) => {
    const els = node instanceof Element ? [node, ...node.querySelectorAll('*')] : [...node.querySelectorAll('*')];
    for (const el of els) {
      if (el.matches(PASSWORD)) passwords.add(el);
      if (el.shadowRoot) watch(el.shadowRoot);
    }
  };
  const typeWatch = new MutationObserver((changes) => {
    for (const c of changes) {
      if (c.type === 'attributes' && c.oldValue?.toLowerCase() === 'password') passwords.add(c.target as Element);
      for (const n of c.addedNodes) if (n.nodeType === 1) scan(n as Element);
    }
  });
  const watch = (root: Document | ShadowRoot) => {
    if (watched.has(root)) return;
    watched.add(root);
    typeWatch.observe(root, { subtree: true, childList: true, attributeFilter: ['type'], attributeOldValue: true });
    scan(root);
  };
  watch(doc);

  // `input` (unlike `change`) crosses shadow roots, and fires for every control kind.
  const onInput = (e: Event) => {
    const el = targetOf(e);
    if (!el) return;
    notePassword(e);
    if (passwords.has(el)) {
      put(el, { action: 'type', label: `Type password in ${describe(el)}`, value: '', secret: true });
    } else if (isTextEntry(el)) {
      const value = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? (el as HTMLInputElement).value : (el.textContent ?? '');
      put(el, { action: 'type', label: `Type in ${describe(el)}`, value, secret: false });
    } else if (el.tagName === 'SELECT') {
      const select = el as HTMLSelectElement;
      const option = select.selectedOptions[0]?.text.trim() ?? '';
      put(el, { action: 'select', label: `Choose "${option}" in ${describe(el)}`, value: select.value });
    } else if (el.matches('input[type=checkbox],input[type=radio]')) {
      const { checked, type } = el as HTMLInputElement;
      const verb = type === 'radio' ? 'Pick' : checked ? 'Check' : 'Uncheck';
      put(el, { action: 'check', label: `${verb} ${describe(el)}`, checked });
    } else if (el.matches('input[type=file]')) {
      put(el, { action: 'upload', label: `Upload a file to ${describe(el)}` });
    }
  };

  const onKey = (e: KeyboardEvent) => {
    const el = targetOf(e);
    if (!el || MODIFIERS.includes(e.key)) return;
    const shortcut = e.ctrlKey || e.metaKey || e.altKey;
    if (!shortcut && !NAMED_KEYS.includes(e.key)) return;
    // Enter on a button or link fires a click, which records it.
    if (!shortcut && e.key === 'Enter' && el.matches(ACTIVATES)) return;
    const key = [
      e.ctrlKey && 'Control',
      e.metaKey && 'Meta',
      e.altKey && 'Alt',
      e.shiftKey && 'Shift',
      e.key.length === 1 ? e.key.toUpperCase() : e.key,
    ]
      .filter(Boolean)
      .join('+');
    put(el, { action: 'key', label: `Press ${key}`, key });
  };

  const onScroll = (e: Event) => {
    clearTimeout(scrollTimer);
    const box = e.target instanceof doc.defaultView!.Element ? e.target : null;
    scrollTimer = setTimeout(() => {
      const view = doc.defaultView!;
      const r = box?.getBoundingClientRect() ?? { left: 0, top: 0, width: view.innerWidth, height: view.innerHeight };
      const el = doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (el) put(el, { action: 'scroll', label: `Scroll to ${describe(el)}` });
    }, 500);
  };

  const onMove = (e: MouseEvent) => {
    clearTimeout(hoverTimer);
    const el = targetOf(e);
    if (!el) return;
    hoverTimer = setTimeout(() => {
      if (last?.el !== el) put(el, { action: 'hover', label: `Hover over ${describe(el)}` });
    }, 1000);
  };

  const listeners: [string, EventListener][] = [
    ['click', onClick as EventListener],
    ['dblclick', onDblClick as EventListener],
    ['focusin', notePassword],
    ['input', onInput],
    ['keydown', onKey as EventListener],
    ['scroll', onScroll],
  ];
  if (hover) listeners.push(['mousemove', onMove as EventListener]);
  for (const [type, fn] of listeners) doc.addEventListener(type, fn, { capture: true, passive: true });
  return () => {
    for (const [type, fn] of listeners) doc.removeEventListener(type, fn, { capture: true });
    clearTimeout(scrollTimer);
    clearTimeout(hoverTimer);
    typeWatch.disconnect();
  };
}
