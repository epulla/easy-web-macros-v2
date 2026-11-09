import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { macros as macrosItem } from '../../src/bg/state';
import type { ToBackground } from '../background';
import { duplicateStep, exportMacro, importMacro, moveStep, type LocatorKind, type Macro, type Step } from '../../src/core/macro';
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

// `count` only marks a section's position and never finds an element by itself, so it isn't offered.
const KIND: Record<Exclude<LocatorKind, 'count'>, string> = {
  id: 'Element id',
  testId: 'Test id',
  role: 'Kind and name',
  text: 'Text on it',
  label: 'Field label',
  css: 'CSS selector',
  xpath: 'XPath',
};

const send = (msg: ToBackground) => browser.runtime.sendMessage(msg);

// Focuses the first of these that exists and is turned on, once React has updated the page.
const focusSoon = (...ids: string[]) =>
  requestAnimationFrame(() =>
    ids
      .map((id) => document.getElementById(id) as HTMLButtonElement | null)
      .find((el) => el && !el.disabled)
      ?.focus(),
  );

// Macros with edits still on their way to storage; storage updates keep our copy of those.
const pending = new Map<string, number>();

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
    return macrosItem.watch((ms) => show(ms.flatMap((m) => (pending.has(m.id) ? latest.current.filter((x) => x.id === m.id) : [m]))));
  }, []);

  // The background applies each change to the latest saved macros, so recordings and
  // repairs made meanwhile are kept.
  const write = (id: string, next: Macro[], msg: ToBackground) => {
    show(next);
    pending.set(id, (pending.get(id) ?? 0) + 1);
    send(msg)
      .then(
        () => setError(''),
        () => setError("Couldn't save your last change. Try again."),
      )
      .finally(() => {
        const n = pending.get(id)! - 1;
        if (n) pending.set(id, n);
        else pending.delete(id);
      });
  };

  const change = (id: string, fn: (m: Macro) => Macro) => {
    const next = latest.current.map((m) => (m.id === id ? fn(m) : m));
    write(id, next, { type: 'save-macro', macro: next.find((m) => m.id === id)! });
  };

  const remove = (id: string) => {
    const i = latest.current.findIndex((m) => m.id === id);
    const next = latest.current.filter((m) => m.id !== id);
    write(id, next, { type: 'delete-macro', id });
    const neighbour = next[Math.min(i, next.length - 1)];
    if (neighbour) select(neighbour.id);
    focusSoon(neighbour ? `macro-${neighbour.id}` : 'empty');
  };

  const select = (id: string) => {
    setSelected(id);
    history.replaceState(null, '', `#${id}`);
  };

  const macro = macros.find((m) => m.id === selected) ?? macros[0];

  const importFile = async (file: File) => {
    try {
      const added = importMacro(await file.text());
      await send({ type: 'add-macro', macro: added });
      show([...latest.current.filter((m) => m.id !== added.id), added]);
      select(added.id);
    } catch (e) {
      setError(e instanceof Error && !/^Could not establish/.test(e.message) ? e.message : "Couldn't add this macro. Try again.");
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header className="flex items-center gap-3">
        <span aria-hidden className="reel" />
        <h1 className="text-xl font-semibold tracking-wide">Easy Web Macros</h1>
        <span aria-hidden className="reel" />
        <p className="flex-1 text-muted">Edit your macros. Changes are saved as you go.</p>
        <label className="btn cursor-pointer focus-within:outline-2 focus-within:outline-rec">
          Add a macro from a file
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void importFile(file);
            }}
          />
        </label>
      </header>
      {error && (
        <p role="alert" className="text-rec">
          {error}
        </p>
      )}
      {macros.length === 0 ? (
        <p id="empty" tabIndex={-1} className="cassette p-4">No macros yet. Click the Easy Web Macros icon in your browser toolbar and press Record.</p>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <nav aria-label="Your macros" className="flex flex-col gap-1 md:w-60 md:shrink-0">
            {macros.map((m) => (
              <button
                key={m.id}
                id={`macro-${m.id}`}
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
              change={(fn) => change(macro.id, fn)}
              remove={() => remove(macro.id)}
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

  const steps = (fn: (s: Step[]) => Step[]) => change((m) => ({ ...m, steps: fn(m.steps) }));
  // `focus` lists the pressed arrow first; at a list end it turns off and its partner gets focus.
  const move = (from: number, to: number, focus: string[] = []) => {
    if (to < 0 || to >= macro.steps.length || from === to) return;
    steps((s) => moveStep(s, from, to));
    focusSoon(...focus);
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
        <h2 id="steps-title" tabIndex={-1} className="font-semibold">
          Steps
        </h2>
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
                  <button id={`up-${step.id}`} className="btn px-2" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1, [`up-${step.id}`, `down-${step.id}`])}>
                    ↑
                  </button>
                  <button
                    id={`down-${step.id}`}
                    className="btn px-2"
                    aria-label={`Move step ${i + 1} down`}
                    disabled={i === macro.steps.length - 1}
                    onClick={() => move(i, i + 1, [`down-${step.id}`, `up-${step.id}`])}
                  >
                    ↓
                  </button>
                  <button
                    id={`edit-btn-${step.id}`}
                    className="btn"
                    aria-label={`Edit step ${i + 1}`}
                    aria-expanded={open === step.id}
                    aria-controls={`edit-${step.id}`}
                    onClick={() => setOpen(open === step.id ? null : step.id)}
                  >
                    Edit
                  </button>
                  <button className="btn" aria-label={`Duplicate step ${i + 1}`} onClick={() => steps((s) => duplicateStep(s, i))}>
                    Duplicate
                  </button>
                  <button
                    className="btn text-rec"
                    aria-label={`Delete step ${i + 1}`}
                    onClick={() => {
                      if (!confirm(`Delete step ${i + 1}, "${step.label}"?`)) return;
                      const near = macro.steps[i + 1] ?? macro.steps[i - 1];
                      steps((s) => s.filter((x) => x.id !== step.id));
                      focusSoon(near ? `edit-btn-${near.id}` : 'steps-title');
                    }}
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

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <button
          className="btn"
          onClick={() => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([exportMacro(macro)], { type: 'application/json' }));
            a.download = `${macro.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'macro'}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }}
        >
          Save to a file
        </button>
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
          <p className="text-xs text-muted">
            Tried from top to bottom until one matches. CSS selector and XPath are only used when no other way is listed, because they can point at
            the wrong thing after a page changes. Easier: play the macro and use "Pick it on the page" when a step fails.
          </p>
          {step.locators.map((l, j) => (
            <div key={j} className="flex gap-2">
              <select
                aria-label={`Way ${j + 1}: type`}
                className="field"
                value={l.kind}
                onChange={(e) => change({ locators: step.locators.with(j, { ...l, kind: e.target.value as LocatorKind }) })}
              >
                {Object.entries(KIND).map(([k, name]) => (
                  <option key={k} value={k}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Way ${j + 1}: value`}
                className="field min-w-0 flex-1 font-mono text-xs"
                value={l.value}
                onChange={(e) => change({ locators: step.locators.with(j, { ...l, value: e.target.value }) })}
              />
              <button
                id={`loc-rm-${step.id}-${j}`}
                className="btn"
                aria-label={`Remove way ${j + 1}`}
                onClick={() => {
                  change({ locators: step.locators.toSpliced(j, 1) });
                  // The next way slides into this slot.
                  focusSoon(`loc-rm-${step.id}-${j + 1 < step.locators.length ? j : j - 1}`, `loc-add-${step.id}`);
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button id={`loc-add-${step.id}`} className="btn self-start" onClick={() => change({ locators: [...step.locators, { kind: 'text', value: '' }] })}>
            Add a way to find it
          </button>
        </fieldset>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Options />);
