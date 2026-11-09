export const LOCATOR_KINDS = ['id', 'testId', 'role', 'text', 'label', 'css', 'xpath', 'count'] as const;
export type LocatorKind = (typeof LOCATOR_KINDS)[number];

export interface Locator {
  kind: LocatorKind;
  value: string;
}

interface StepBase {
  id: string;
  label: string;
  locators: Locator[];
  // Locators for each shadow host / iframe around the target, outermost first. A `count`
  // entry marks a position-only host: replay needs the same number of same-tag hosts.
  scope?: Locator[][];
}

export type Step =
  | (StepBase & { action: 'click' | 'dblclick' | 'hover' | 'scroll' | 'upload' })
  | (StepBase & { action: 'type'; value: string; secret: boolean })
  | (StepBase & { action: 'select'; value: string })
  | (StepBase & { action: 'check'; checked: boolean })
  | (StepBase & { action: 'key'; key: string })
  | (StepBase & { action: 'navigate'; url: string; newTab: boolean });

export interface Macro {
  id: string;
  name: string;
  steps: Step[];
  delayMs: number;
  runs: number;
  loop: boolean;
}

export const DEFAULTS = { delayMs: 1000, runs: 1, loop: false } as const;

// v1 0.0.6 shapes, from epulla/easy-web-macros src/lib/step.ts and collection.ts
export interface V1Step {
  id: string;
  strategy: 'ButtonClick' | 'InputSendKeys' | 'AClick';
  visibility: 'visible' | 'hidden';
  status: string;
  xpath?: string;
  label?: string;
  value?: string;
  error?: string;
}

export interface V1Collection {
  id: string;
  name: string;
  steps: V1Step[];
  delayBetweenSteps: number;
  numberOfRuns: number;
  doesLoopInfinitely: boolean;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isVisibility = (v: unknown): v is V1Step['visibility'] => v === 'visible' || v === 'hidden';

// Omitted v1 fields get defaults; present but wrong-typed ones mean damaged data.
function optional<T>(v: unknown, ok: (v: unknown) => v is T, fallback: T, field: string): T {
  if (v === undefined) return fallback;
  if (!ok(v)) throw new Error(`Invalid v1 ${field}`);
  return v;
}

function fromV1Step(s: V1Step): Step {
  if (!isObject(s) || !isString(s.id)) throw new Error('Invalid v1 step');
  const xpath = optional(s.xpath, isString, '', 'xpath');
  const secret = optional(s.visibility, isVisibility, 'visible', 'visibility') === 'hidden';
  const base = {
    id: s.id,
    label: optional(s.label, isString, '', 'label'),
    locators: xpath ? [{ kind: 'xpath' as const, value: xpath }] : [],
  };
  if (s.strategy === 'ButtonClick' || s.strategy === 'AClick') return { ...base, action: 'click' };
  if (s.strategy === 'InputSendKeys') {
    return {
      ...base,
      action: 'type',
      value: optional(s.value, isString, '', 'value'),
      secret,
    };
  }
  throw new Error(`Unknown v1 step type: ${String(s.strategy)}`);
}

export function fromV1(c: V1Collection): Macro {
  if (!isObject(c) || !isString(c.name) || !Array.isArray(c.steps)) {
    throw new Error('Invalid v1 collection');
  }
  return {
    id: optional(c.id, isString, '', 'id') || crypto.randomUUID(),
    name: c.name,
    steps: c.steps.map(fromV1Step),
    delayMs: optional(c.delayBetweenSteps, isNumber, DEFAULTS.delayMs, 'delay'),
    runs: optional(c.numberOfRuns, isNumber, DEFAULTS.runs, 'number of runs'),
    loop: optional(c.doesLoopInfinitely, isBoolean, DEFAULTS.loop, 'loop setting'),
  };
}

// Skips invalid collections; the caller keeps the raw v1 data, so nothing is lost.
export function migrate(collections: Record<string, V1Collection>): Macro[] {
  return Object.values(collections).flatMap((c) => {
    try {
      return [fromV1(c)];
    } catch {
      return [];
    }
  });
}

const isLocators = (ls: unknown): ls is Locator[] =>
  Array.isArray(ls) &&
  ls.every((l) => isObject(l) && LOCATOR_KINDS.includes(l.kind as LocatorKind) && typeof l.value === 'string');

function isStep(s: unknown): s is Step {
  if (!isObject(s) || typeof s.id !== 'string' || typeof s.label !== 'string') return false;
  if (!isLocators(s.locators)) return false;
  if (s.scope !== undefined && !(Array.isArray(s.scope) && s.scope.every(isLocators))) return false;
  switch (s.action) {
    case 'click':
    case 'dblclick':
    case 'hover':
    case 'scroll':
    case 'upload':
      return true;
    case 'type':
      return isString(s.value) && isBoolean(s.secret);
    case 'select':
      return isString(s.value);
    case 'check':
      return isBoolean(s.checked);
    case 'key':
      return isString(s.key);
    case 'navigate':
      return isString(s.url) && isBoolean(s.newTab);
    default:
      return false;
  }
}

function isMacro(m: unknown): m is Macro {
  return (
    isObject(m) &&
    typeof m.name === 'string' &&
    Array.isArray(m.steps) &&
    m.steps.every(isStep) &&
    isNumber(m.delayMs) &&
    isNumber(m.runs) &&
    typeof m.loop === 'boolean'
  );
}

export const exportMacro = (macro: Macro): string => JSON.stringify({ version: 2, macro });

// Accepts a v2 export or a v1 `<name>.em.json` file; the result always gets a new id.
export function importMacro(text: string): Macro {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a macro file.");
  }
  if (isObject(data) && data.version === 2) {
    if (!isMacro(data.macro)) throw new Error("This macro file is damaged and can't be imported.");
    return { ...data.macro, id: crypto.randomUUID() };
  }
  if (isObject(data) && 'delayBetweenSteps' in data) {
    try {
      return { ...fromV1(data as unknown as V1Collection), id: crypto.randomUUID() };
    } catch {
      throw new Error("This macro file is damaged and can't be imported.");
    }
  }
  throw new Error("This file isn't a macro file.");
}
