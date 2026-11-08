import type { Locator } from './macro';

type Root = Document | ShadowRoot;

const IMPLICIT_ROLES: Record<string, string> = {
  button: 'button,input[type=button],input[type=submit],input[type=reset],input[type=image],summary',
  link: 'a[href],area[href]',
  checkbox: 'input[type=checkbox]',
  radio: 'input[type=radio]',
  combobox: 'select',
  textbox:
    'input:not([type]),input[type=text],input[type=email],input[type=tel],input[type=url],input[type=password],input[type=number],textarea',
  searchbox: 'input[type=search]',
  heading: 'h1,h2,h3,h4,h5,h6',
  img: 'img[alt]:not([alt=""])',
};
const NAME_FROM_CONTENT = new Set(['button', 'link', 'heading', 'checkbox', 'radio']);
const TEST_ID_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa'];
const MAX_TEXT = 80;

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const attr = (name: string, value: string) => `[${name}="${value.replace(/["\\]/g, '\\$&')}"]`;
// Framework-generated ids/classes (":r1:", "ember123", "css-1x2y3z") change between page loads.
const looksGenerated = (s: string) => /^:|\d{3,}|^(css|sc|jsx|emotion)-/.test(s);
const split = (value: string): [string, string] => {
  const i = value.indexOf(' ');
  return i < 0 ? [value, ''] : [value.slice(0, i), value.slice(i + 1)];
};
const tag = (el: Element) => el.tagName.toLowerCase();

function roleOf(el: Element): string {
  const explicit = el.getAttribute('role')?.trim().split(/\s+/)[0];
  if (explicit) return explicit;
  return Object.keys(IMPLICIT_ROLES).find((r) => el.matches(IMPLICIT_ROLES[r]!)) ?? '';
}

const labelText = (el: Element) =>
  clean(Array.from((el as HTMLInputElement).labels ?? [], (l) => l.textContent).join(' '));

function nameOf(el: Element): string {
  const root = el.getRootNode() as Root;
  const ids = el.getAttribute('aria-labelledby');
  if (ids) {
    const text = clean(ids.split(/\s+/).map((id) => root.getElementById?.(id)?.textContent).join(' '));
    if (text) return text;
  }
  const name =
    clean(el.getAttribute('aria-label')) ||
    labelText(el) ||
    clean(el.getAttribute('alt')) ||
    (NAME_FROM_CONTENT.has(roleOf(el)) ? clean(el.textContent) : '') ||
    (el.matches('input[type=button],input[type=submit],input[type=reset]') ? clean((el as HTMLInputElement).value) : '');
  return name || clean(el.getAttribute('title')) || clean(el.getAttribute('placeholder'));
}

function evaluateXPath(root: Root, xpath: string): Element[] {
  const doc = root.ownerDocument ?? (root as Document);
  try {
    const result = doc.evaluate(xpath, root, null, 7 /* ORDERED_NODE_SNAPSHOT_TYPE */, null);
    return Array.from({ length: result.snapshotLength }, (_, i) => result.snapshotItem(i) as Element);
  } catch {
    return [];
  }
}

function query(root: Root, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function matchIn(root: Root, { kind, value }: Locator): Element[] {
  switch (kind) {
    case 'id':
      return query(root, attr('id', value));
    case 'testId':
    case 'css':
      return query(root, value);
    case 'role': {
      const [role, name] = split(value);
      const implicit = IMPLICIT_ROLES[role];
      return query(root, `[role]${implicit ? `,${implicit}` : ''}`).filter(
        (el) => roleOf(el) === role && nameOf(el) === name,
      );
    }
    case 'text': {
      const [t, text] = split(value);
      return query(root, t).filter((el) => clean(el.textContent) === text);
    }
    case 'label': {
      const [how, text] = split(value);
      if (how === 'name' || how === 'placeholder') return query(root, attr(how, text));
      return query(root, 'input,select,textarea').filter((el) => labelText(el) === text);
    }
    case 'xpath':
      return evaluateXPath(root, value);
  }
}

export function roots(doc: Document): Root[] {
  return [doc];
}

export function match(doc: Document, locator: Locator): Element[] {
  return [...new Set(roots(doc).flatMap((root) => matchIn(root, locator)))];
}

function cssPath(el: Element): string {
  const parts: string[] = [];
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    if (cur !== el && cur.id && !looksGenerated(cur.id)) {
      parts.unshift(attr('id', cur.id));
      break;
    }
    const sameTag = cur.parentElement ? Array.from(cur.parentElement.children).filter((c) => c.tagName === cur!.tagName) : [];
    parts.unshift(sameTag.length > 1 ? `${tag(cur)}:nth-of-type(${sameTag.indexOf(cur) + 1})` : tag(cur));
  }
  return parts.join(' > ');
}

function xpathOf(el: Element, root: Root): string {
  const parts: string[] = [];
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const sameTag = cur.parentElement ? Array.from(cur.parentElement.children).filter((c) => c.tagName === cur!.tagName) : [];
    parts.unshift(sameTag.length > 1 ? `${tag(cur)}[${sameTag.indexOf(cur) + 1}]` : tag(cur));
    if (cur.parentNode === root) break;
  }
  return (root.nodeType === 9 ? '/' : './') + parts.join('/');
}

// Most stable first: intentional test hooks, ids, then what the user sees, then structure.
function candidates(el: Element): Locator[] {
  const root = el.getRootNode() as Root;
  const out: Locator[] = [];
  for (const a of TEST_ID_ATTRS) {
    const v = el.getAttribute(a);
    if (v) out.push({ kind: 'testId', value: attr(a, v) });
  }
  if (el.id && !looksGenerated(el.id)) out.push({ kind: 'id', value: el.id });
  const role = roleOf(el);
  const name = nameOf(el);
  if (role && name && name.length <= MAX_TEXT) out.push({ kind: 'role', value: `${role} ${name}` });
  const label = labelText(el);
  if (label) out.push({ kind: 'label', value: `label ${label}` });
  for (const a of ['name', 'placeholder'] as const) {
    const v = el.getAttribute(a);
    if (v) out.push({ kind: 'label', value: `${a} ${v}` });
  }
  const text = clean(el.textContent);
  if (text && text.length <= MAX_TEXT) out.push({ kind: 'text', value: `${tag(el)} ${text}` });
  out.push({ kind: 'css', value: cssPath(el) });
  out.push({ kind: 'xpath', value: xpathOf(el, root) });
  return out;
}

// Position-based locators hit a neighbour once the target is gone, so they only
// apply when nothing else was recorded (e.g. migrated v1 steps).
export function findElement(locators: Locator[], doc: Document = document): Element | null {
  const semantic = locators.filter((l) => l.kind !== 'css' && l.kind !== 'xpath');
  for (const l of semantic.length ? semantic : locators) {
    const found = match(doc, l);
    if (found.length === 1) return found[0]!;
  }
  return null;
}

const isVisible = (el: Element) => el.checkVisibility({ visibilityProperty: true });
const isEnabled = (el: Element) => !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true';

export async function waitForElement(
  locators: Locator[],
  { doc = document, timeoutMs = 10_000 }: { doc?: Document; timeoutMs?: number } = {},
): Promise<Element> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const el = findElement(locators, doc);
    if (el && isVisible(el) && isEnabled(el)) return el;
    if (Date.now() >= deadline) {
      if (!el) throw new Error("Couldn't find this element on the page.");
      throw new Error(isVisible(el) ? 'This element is turned off (disabled).' : 'This element is hidden.');
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

// Keeps only locators that point at exactly this element right now.
export function captureLocators(el: Element, doc: Document = el.ownerDocument): Locator[] {
  return candidates(el).filter((l) => {
    const found = match(doc, l);
    return found.length === 1 && found[0] === el;
  });
}
