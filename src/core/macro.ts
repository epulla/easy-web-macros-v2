export const LOCATOR_KINDS = ['id', 'testId', 'role', 'text', 'label', 'css', 'xpath'] as const;
export type LocatorKind = (typeof LOCATOR_KINDS)[number];

export interface Locator {
  kind: LocatorKind;
  value: string;
}

interface StepBase {
  id: string;
  label: string;
  locators: Locator[];
}

export type Step =
  | (StepBase & { action: 'click' })
  | (StepBase & { action: 'type'; value: string; secret: boolean });

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

function fromV1Step(s: V1Step): Step {
  if (!isObject(s) || typeof s.id !== 'string') throw new Error('Invalid v1 step');
  const base = {
    id: s.id,
    label: typeof s.label === 'string' ? s.label : '',
    locators: typeof s.xpath === 'string' && s.xpath ? [{ kind: 'xpath' as const, value: s.xpath }] : [],
  };
  if (s.strategy === 'ButtonClick' || s.strategy === 'AClick') return { ...base, action: 'click' };
  if (s.strategy === 'InputSendKeys') {
    return {
      ...base,
      action: 'type',
      value: typeof s.value === 'string' ? s.value : '',
      secret: s.visibility === 'hidden',
    };
  }
  throw new Error(`Unknown v1 step type: ${String(s.strategy)}`);
}

export function fromV1(c: V1Collection): Macro {
  if (!isObject(c) || typeof c.name !== 'string' || !Array.isArray(c.steps)) {
    throw new Error('Invalid v1 collection');
  }
  return {
    id: typeof c.id === 'string' && c.id ? c.id : crypto.randomUUID(),
    name: c.name,
    steps: c.steps.map(fromV1Step),
    delayMs: isNumber(c.delayBetweenSteps) ? c.delayBetweenSteps : DEFAULTS.delayMs,
    runs: isNumber(c.numberOfRuns) ? c.numberOfRuns : DEFAULTS.runs,
    loop: typeof c.doesLoopInfinitely === 'boolean' ? c.doesLoopInfinitely : DEFAULTS.loop,
  };
}

export function migrate(collections: Record<string, V1Collection>): Macro[] {
  return Object.values(collections).map(fromV1);
}

function isStep(s: unknown): s is Step {
  if (!isObject(s) || typeof s.id !== 'string' || typeof s.label !== 'string') return false;
  if (!Array.isArray(s.locators)) return false;
  const locatorsOk = s.locators.every(
    (l) => isObject(l) && LOCATOR_KINDS.includes(l.kind as LocatorKind) && typeof l.value === 'string',
  );
  if (!locatorsOk) return false;
  if (s.action === 'click') return true;
  return s.action === 'type' && typeof s.value === 'string' && typeof s.secret === 'boolean';
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
