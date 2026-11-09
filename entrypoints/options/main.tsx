import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { macros as macrosItem } from '../../src/bg/state';
import { duplicateStep, LOCATOR_KINDS, moveStep, type LocatorKind, type Macro, type Step } from '../../src/core/macro';
import '../../assets/tailwind.css';

const ACTION: Record<Step['action'], string> = {
  click: 'Click',
  dblclick: 'Double-click',
  hover: 'Point at',
  scroll: 'Scroll',
  upload: 'File',
  type: 'Type',
  select: 'Choose',
  check: 'Tick box',
  key: 'Key',
  navigate: 'Open page',
};

const KIND: Record<LocatorKind, string> = {
  id: 'Element id',
  testId: 'Test id',
  role: 'Kind and name',
  text: 'Text on it',
  label: 'Field label',
  css: 'CSS selector',
  xpath: 'XPath',
  count: 'Position',
};

let queue: Promise<unknown> = Promise.resolve();
let pending = 0;

function Options() {
  const [macros, setMacros] = useState<Macro[]>([]);
  const latest = useRef<Macro[]>([]);
  const [selected, setSelected] = useState(location.hash.slice(1));
  const [error, setError] = useState('');

  const show = (ms: Macro[]) => {
    latest.current = ms;
    setMacros(ms);
  };

  useEffect(() => {
    void macrosItem.getValue().then(show);
    // Skip echoes of our own writes so typing never jumps back.
    return macrosItem.watch((ms) => pending === 0 && show(ms));
  }, []);

  // Applied once to what's on screen, so ids made by `fn` match what gets saved.
  const save = (fn: (ms: Macro[]) => Macro[]) => {
    const next = fn(latest.current);
    show(next);
    pending++;
    queue = queue
      .then(() => macrosItem.setValue(next))
      .then(
        () => setError(''),
        () => setError("Couldn't save your last change. Try again."),
      )
      .finally(() => pending--);
  };

  const select = (id: string) => {
    setSelected(id);
    history.replaceState(null, '', `#${id}`);
  };

  const macro = macros.find((m) => m.id === selected) ?? macros[0];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header className="flex items-center gap-3">
        <span aria-hidden className="reel" />
        <h1 className="text-xl font-semibold tracking-wide">Easy Web Macros</h1>
        <span aria-hidden className="reel" />
        <p className="text-muted">Edit your macros. Changes are saved as you go.</p>
      </header>
      {error && (
        <p role="alert" className="text-rec">
          {error}
        </p>
      )}
      {macros.length === 0 ? (
        <p className="cassette p-4">No macros yet. Click the Easy Web Macros icon in your browser toolbar and press Record.</p>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <nav aria-label="Your macros" className="flex flex-col gap-1 md:w-60 md:shrink-0">
            {macros.map((m) => (
              <button
                key={m.id}
                className="cassette text-left hover:border-muted aria-[current=true]:border-rec"
                aria-current={m.id === macro?.id}
                onClick={() => select(m.id)}
              >
                <span className="block truncate font-medium">{m.name}</span>
                <span className="text-xs text-muted">
                  {m.steps.length} {m.steps.length === 1 ? 'step' : 'steps'}
                </span>
              </button>
            ))}
          </nav>
          {macro && (
            <MacroEditor
              key={macro.id}
              macro={macro}
              change={(fn) => save((ms) => ms.map((m) => (m.id === macro.id ? fn(m) : m)))}
              remove={() => save((ms) => ms.filter((m) => m.id !== macro.id))}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MacroEditor({ macro, change, remove }: { macro: Macro; change: (fn: (m: Macro) => Macro) => void; remove: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const focusAfter = useRef<string | null>(null);

  useEffect(() => {
    if (focusAfter.current) document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  const steps = (fn: (s: Step[]) => Step[]) => change((m) => ({ ...m, steps: fn(m.steps) }));
  const move = (from: number, to: number, focusId?: string) => {
    if (to < 0 || to >= macro.steps.length || from === to) return;
    steps((s) => moveStep(s, from, to));
    focusAfter.current = focusId ?? null;
    setAnnounce(`Moved step ${from + 1} to position ${to + 1}.`);
  };

  return (
    <section aria-label={`Edit ${macro.name}`} className="cassette flex min-w-0 flex-1 flex-col gap-4 p-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input className="field text-base font-normal" value={macro.name} onChange={(e) => change((m) => ({ ...m, name: e.target.value }))} />
      </label>
      <div className="flex flex-wrap items-end gap-4 text-sm">
        <label className="flex flex-col gap-1">
          Wait between steps (seconds)
          <input
            type="number"
            min={0}
            step={0.1}
            className="field w-28"
            value={macro.delayMs / 1000}
            onChange={(e) => {
              const s = e.target.valueAsNumber;
              if (Number.isFinite(s) && s >= 0) change((m) => ({ ...m, delayMs: Math.round(s * 1000) }));
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          Times to play
          <input
            type="number"
            min={1}
            step={1}
            className="field w-24 disabled:opacity-50"
            disabled={macro.loop}
            value={macro.runs}
            onChange={(e) => {
              const n = e.target.valueAsNumber;
              if (Number.isInteger(n) && n >= 1) change((m) => ({ ...m, runs: n }));
            }}
          />
        </label>
        <label className="flex items-center gap-2 pb-1.5">
          <input type="checkbox" checked={macro.loop} onChange={(e) => change((m) => ({ ...m, loop: e.target.checked }))} />
          Keep repeating until I press Stop
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Steps</h2>
        <p className="text-sm text-muted">Drag the ⋮⋮ handle or use the arrow buttons to change the order.</p>
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
        {macro.steps.length === 0 && <p className="text-sm text-muted">This macro has no steps.</p>}
        <ol className="tracks">
          {macro.steps.map((step, i) => (
            <li
              key={step.id}
              className={`flex flex-col gap-2 rounded ${dragFrom === i ? 'opacity-50' : ''}`}
              onDragOver={(e) => dragFrom !== null && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) move(dragFrom, i);
                setDragFrom(null);
              }}
            >
              <div className="track flex-wrap">
                <span
                  draggable
                  aria-hidden
                  title="Drag to move"
                  className="cursor-grab select-none text-muted"
                  onDragStart={(e) => {
                    setDragFrom(i);
                    e.dataTransfer.effectAllowed = 'move';
                    const row = e.currentTarget.parentElement;
                    if (row) e.dataTransfer.setDragImage(row, 10, 10);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                >
                  ⋮⋮
                </span>
                <span className="track-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="rounded border px-1.5 text-xs text-muted">{ACTION[step.action]}</span>
                <span className="track-label min-w-0 flex-1 truncate">{step.label || 'Untitled step'}</span>
                <span className="flex gap-1">
                  <button id={`up-${step.id}`} className="btn px-2" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1, `up-${step.id}`)}>
                    ↑
                  </button>
                  <button
                    id={`down-${step.id}`}
                    className="btn px-2"
                    aria-label={`Move step ${i + 1} down`}
                    disabled={i === macro.steps.length - 1}
                    onClick={() => move(i, i + 1, `down-${step.id}`)}
                  >
                    ↓
                  </button>
                  <button className="btn" aria-expanded={open === step.id} aria-controls={`edit-${step.id}`} onClick={() => setOpen(open === step.id ? null : step.id)}>
                    {open === step.id ? 'Done' : 'Edit'}
                  </button>
                  <button className="btn" aria-label={`Duplicate step ${i + 1}`} onClick={() => steps((s) => duplicateStep(s, i))}>
                    Duplicate
                  </button>
                  <button
                    className="btn text-rec"
                    aria-label={`Delete step ${i + 1}`}
                    onClick={() => confirm(`Delete step ${i + 1}, "${step.label}"?`) && steps((s) => s.filter((x) => x.id !== step.id))}
                  >
                    Delete
                  </button>
                </span>
              </div>
              {open === step.id && (
                <div id={`edit-${step.id}`} className="ml-2 border-l-2 border-tape pl-3 pb-2">
                  <StepFields step={step} change={(patch) => steps((s) => s.map((x) => (x.id === step.id ? ({ ...x, ...patch } as Step) : x)))} />
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="border-t pt-3">
        <button className="btn text-rec" onClick={() => confirm(`Delete "${macro.name}"? This can't be undone.`) && remove()}>
          Delete this macro
        </button>
      </div>
    </section>
  );
}

function StepFields({ step, change }: { step: Step; change: (patch: Partial<Step>) => void }) {
  const text = (label: string, value: string, set: (v: string) => void, type = 'text') => (
    <label className="flex flex-col gap-1">
      {label}
      <input type={type} className="field" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
  return (
    <div className="flex flex-col gap-3 text-sm">
      {text('Step name', step.label, (label) => change({ label }))}
      {step.action === 'type' &&
        (step.secret ? (
          <p className="text-muted">This is a password. It's never saved; you'll be asked to type it each time the macro plays.</p>
        ) : (
          text('Text to type', step.value, (value) => change({ value }))
        ))}
      {step.action === 'select' && text('Option to choose', step.value, (value) => change({ value }))}
      {step.action === 'key' && text('Key to press (for example Enter or Control+S)', step.key, (key) => change({ key }))}
      {step.action === 'check' && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={step.checked} onChange={(e) => change({ checked: e.target.checked })} />
          Box is ticked after this step
        </label>
      )}
      {step.action === 'navigate' && (
        <>
          {text('Web address', step.url, (url) => change({ url }), 'url')}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={step.newTab} onChange={(e) => change({ newTab: e.target.checked })} />
            Opens in a new tab
          </label>
        </>
      )}
      {step.action !== 'navigate' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium">How to find it on the page</legend>
          <p className="text-xs text-muted">Tried from top to bottom until one matches. Easier: play the macro and use "Pick it on the page" when a step fails.</p>
          {step.locators.map((l, j) => (
            <div key={j} className="flex gap-2">
              <select
                aria-label={`Way ${j + 1}: type`}
                className="field"
                value={l.kind}
                onChange={(e) => change({ locators: step.locators.with(j, { ...l, kind: e.target.value as LocatorKind }) })}
              >
                {LOCATOR_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND[k]}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Way ${j + 1}: value`}
                className="field min-w-0 flex-1 font-mono text-xs"
                value={l.value}
                onChange={(e) => change({ locators: step.locators.with(j, { ...l, value: e.target.value }) })}
              />
              <button className="btn" aria-label={`Remove way ${j + 1}`} onClick={() => change({ locators: step.locators.toSpliced(j, 1) })}>
                Remove
              </button>
            </div>
          ))}
          <button className="btn self-start" onClick={() => change({ locators: [...step.locators, { kind: 'text', value: '' }] })}>
            Add a way to find it
          </button>
        </fieldset>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Options />);
