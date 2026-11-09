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
// Framework-generated ids/attrs (":r1:", "ember123", "css-1x2y3z", "data-v-7ba5bd90") change between builds.
const looksGenerated = (s: string) => /^:|\d{3,}|^(css|sc|jsx|emotion)-|(?=[a-f]*\d)[0-9a-f]{6,}/i.test(s);
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

function isRendered(el: Element): boolean {
  if (el.matches('[hidden],[aria-hidden=true],script,style,template')) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  return style?.display !== 'none' && style?.visibility !== 'hidden';
}

// Like textContent, minus hidden descendants, so hidden text changes don't break matches.
function visibleText(el: Element): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) parts.push(child.textContent ?? '');
      else if (child.nodeType === 1 && isRendered(child as Element)) walk(child);
    }
  };
  walk(el);
  return clean(parts.join(''));
}

const labelText = (el: Element) =>
  clean(Array.from((el as HTMLInputElement).labels ?? [], visibleText).join(' '));

export function nameOf(el: Element): string {
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
    (NAME_FROM_CONTENT.has(roleOf(el)) ? visibleText(el) : '') ||
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
      return query(root, t).filter((el) => visibleText(el) === text);
    }
    case 'label': {
      const [how, text] = split(value);
      if (how === 'name' || how === 'placeholder') return query(root, attr(how, text));
      return query(root, 'input,select,textarea').filter((el) => labelText(el) === text);
    }
    case 'xpath':
      return root.nodeType === 9 ? evaluateXPath(root, value) : [];
    case 'count':
      return [];
  }
}

// The document plus every open shadow root and same-origin frame inside it.
function roots(start: Root): Root[] {
  const out: Root[] = [];
  const visit = (root: Root) => {
    out.push(root);
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) visit(el.shadowRoot);
      if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
        let frameDoc: Document | null = null;
        try {
          frameDoc = (el as HTMLIFrameElement).contentDocument;
        } catch {
          // cross-origin frame
        }
        if (frameDoc) visit(frameDoc);
      }
    }
  };
  visit(start);
  return out;
}

function innerRoot(host: Element): Root | null {
  try {
    return host.shadowRoot ?? (host as HTMLIFrameElement).contentDocument ?? null;
  } catch {
    return null;
  }
}

// Shadow hosts and frames around el, outermost first.
function hostsOf(el: Element): Element[] {
  const hosts: Element[] = [];
  for (let root = el.getRootNode() as Root; ; ) {
    const host = root.nodeType === 9 ? (root as Document).defaultView?.frameElement : (root as ShadowRoot).host;
    if (!host) return hosts;
    hosts.unshift(host);
    root = host.getRootNode() as Root;
  }
}

function match(space: Root[], locator: Locator): Element[] {
  return [...new Set(space.flatMap((root) => matchIn(root, locator)))];
}

function cssPath(el: Element): string {
  const parts: string[] = [];
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    if (cur !== el && cur.id && !looksGenerated(cur.id)) {
      parts.unshift(attr('id', cur.id));
      break;
    }
    const sameTag = Array.from((cur.parentNode as ParentNode | null)?.children ?? []).filter((c) => c.tagName === cur!.tagName);
    parts.unshift(sameTag.length > 1 ? `${tag(cur)}:nth-of-type(${sameTag.indexOf(cur) + 1})` : tag(cur));
  }
  return parts.join(' > ');
}

function xpathOf(el: Element): string {
  const parts: string[] = [];
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const sameTag = Array.from((cur.parentNode as ParentNode | null)?.children ?? []).filter((c) => c.tagName === cur!.tagName);
    parts.unshift(sameTag.length > 1 ? `${tag(cur)}[${sameTag.indexOf(cur) + 1}]` : tag(cur));
  }
  return '/' + parts.join('/');
}

// Most stable first: intentional test hooks, ids, then what the user sees, then structure.
function candidates(el: Element): Locator[] {
  const root = el.getRootNode() as Root;
  const out: Locator[] = [];
  for (const a of TEST_ID_ATTRS) {
    const v = el.getAttribute(a);
    if (v) out.push({ kind: 'testId', value: attr(a, v) });
  }
  for (const { name: a, value: v } of el.attributes) {
    if (a.startsWith('data-') && !TEST_ID_ATTRS.includes(a) && v && v.length <= MAX_TEXT && !looksGenerated(a) && !looksGenerated(v)) {
      out.push({ kind: 'testId', value: attr(a, v) });
    }
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
  const text = visibleText(el);
  if (text && text.length <= MAX_TEXT) out.push({ kind: 'text', value: `${tag(el)} ${text}` });
  out.push({ kind: 'css', value: cssPath(el) });
  // Chrome can't evaluate XPath inside shadow roots.
  if (root.nodeType === 9) out.push({ kind: 'xpath', value: xpathOf(el) });
  return out;
}

const NOT_FOUND = "Couldn't find this element on the page.";
const isPositional = (l: Locator) => l.kind === 'css' || l.kind === 'xpath';
const countSameTag = (el: Element, space: Root[]) => space.flatMap((root) => query(root, tag(el))).length;
const COUNT_CHANGED = "The page now has a different number of these sections, so I can't tell which one to use.";

// Position-based locators hit a neighbour once the target is gone, so they only
// apply when nothing else was recorded (e.g. migrated v1 steps).
function resolve(locators: Locator[], space: Root[]): Element | null {
  const semantic = locators.filter((l) => !isPositional(l) && l.kind !== 'count');
  for (const l of semantic.length ? semantic : locators.filter(isPositional)) {
    const found = match(space, l);
    if (found.length === 1) return found[0]!;
  }
  return null;
}

export interface Target {
  locators: Locator[];
  scope?: Locator[][];
}

// Returns the element, or why it can't be used yet.
function locate({ locators, scope = [] }: Target, doc: Document): Element | string {
  let space = roots(doc);
  for (const hostLocators of scope) {
    const host = resolve(hostLocators, space);
    const count = hostLocators.find((l) => l.kind === 'count');
    if (host && count && countSameTag(host, space) !== Number(count.value)) return COUNT_CHANGED;
    const inner = host && innerRoot(host);
    if (!inner) return NOT_FOUND;
    space = roots(inner);
  }
  return resolve(locators, space) ?? NOT_FOUND;
}

const isVisible = (el: Element) => el.checkVisibility({ visibilityProperty: true });
function isEnabled(el: Element): boolean {
  if (el.matches(':disabled')) return false;
  for (let n: Element | null = el; n; n = n.parentElement ?? ((n.getRootNode() as ShadowRoot).host ?? null)) {
    if (n.getAttribute('aria-disabled') === 'true') return false;
  }
  return true;
}

export async function waitForElement(
  target: Target,
  { doc = document, timeoutMs = 10_000 }: { doc?: Document; timeoutMs?: number } = {},
): Promise<Element> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const el = locate(target, doc);
    if (typeof el !== 'string' && isVisible(el) && isEnabled(el)) return el;
    if (Date.now() >= deadline) {
      if (typeof el === 'string') throw new Error(el);
      throw new Error(isVisible(el) ? 'This element is turned off (disabled).' : 'This element is hidden.');
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

// Keeps only locators that point at exactly this element within space right now.
const uniqueLocators = (el: Element, space: Root[]) =>
  candidates(el).filter((l) => {
    const found = match(space, l);
    return found.length === 1 && found[0] === el;
  });

// Elements inside shadow DOM or frames also record how to find each host, so
// identical widgets on one page stay distinguishable.
export function captureTarget(el: Element): Target {
  const hosts = hostsOf(el);
  let space = roots((hosts[0] ?? el).ownerDocument);
  const scope: Locator[][] = [];
  for (const host of hosts) {
    const hostLocators = uniqueLocators(host, space);
    if (hostLocators.every(isPositional)) hostLocators.push({ kind: 'count', value: String(countSameTag(host, space)) });
    scope.push(hostLocators);
    space = roots(innerRoot(host)!);
  }
  const locators = uniqueLocators(el, space);
  return scope.length ? { locators, scope } : { locators };
}
