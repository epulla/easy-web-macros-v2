import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { macros as macrosItem } from '../../src/bg/state';
import type { ToBackground } from '../background';
import { applyEdit, exportMacro, importMacro, type LocatorKind, type Macro, type MacroEdit, type Step } from '../../src/core/macro';
import { Close, Download, Down, FileIn, Grip, Logo, More, Trash, Up } from '../../src/ui/icons';
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

// Changes still on their way to storage. Meanwhile storage updates are held back so typing
// never jumps; once all are saved, the saved macros (with any changes from elsewhere) show.
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
    return macrosItem.watch((ms) => pending === 0 && show(ms));
  }, []);

  // The background applies each change to the latest saved macros, so recordings,
  // repairs and edits from another tab made meanwhile are kept.
  const write = (fn: (ms: Macro[]) => Macro[], msg: ToBackground) => {
    show(fn(latest.current));
    pending++;
    send(msg)
      .then(
        () => setError(''),
        () => setError("Couldn't save your last change. Try again."),
      )
      .finally(() => --pending === 0 && void macrosItem.getValue().then((ms) => pending === 0 && show(ms)));
  };

  const edit = (id: string, e: MacroEdit) => write((ms) => ms.map((m) => (m.id === id ? applyEdit(m, e) : m)), { type: 'edit-macro', id, edit: e });

  const remove = (id: string) => {
    const i = latest.current.findIndex((m) => m.id === id);
    write((ms) => ms.filter((m) => m.id !== id), { type: 'delete-macro', id });
    const next = latest.current;
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
    <div className="flex min-h-screen flex-col">
      <header className="flex h-13 items-center gap-2.5 border-b px-6">
        <Logo />
        <h1 className="text-sm font-bold">Easy Web Macros</h1>
        <p className="flex-1 text-xs text-muted">Changes are saved as you go.</p>
        <label className="btn cursor-pointer focus-within:outline-2 focus-within:outline-accent">
          <FileIn />
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
        <p role="alert" className="border-b bg-rec-soft px-6 py-2 text-rec-ink">
          {error}
        </p>
      )}
      {macros.length === 0 ? (
        <p id="empty" tabIndex={-1} className="card m-6 max-w-xl">
          No macros yet. Click the Easy Web Macros icon in your browser toolbar and press Record.
        </p>
      ) : (
        <div className="flex flex-1 flex-col md:flex-row">
          <nav aria-label="Your macros" className="flex flex-col gap-0.5 border-b bg-subtle px-3 py-4 md:w-66 md:shrink-0 md:border-r md:border-b-0">
            <h2 className="section-title px-2 pb-2">Your macros</h2>
            {macros.map((m) => (
              <button
                key={m.id}
                id={`macro-${m.id}`}
                className="rounded-md p-2 text-left hover:bg-raised aria-[current=true]:bg-accent-soft aria-[current=true]:text-accent-ink"
                aria-current={m.id === macro?.id}
                onClick={() => select(m.id)}
              >
                <span className="block font-medium [overflow-wrap:anywhere]">{m.name}</span>
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
              edit={(e) => edit(macro.id, e)}
              remove={() => remove(macro.id)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MacroEditor({ macro, edit, remove }: { macro: Macro; edit: (e: MacroEdit) => void; remove: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');

  const settings = (patch: Extract<MacroEdit, { type: 'settings' }>['patch']) => edit({ type: 'settings', patch });
  // `focus` lists the pressed arrow first; at a list end it turns off and its partner gets focus.
  const move = (from: number, to: number, focus: string[] = []) => {
    if (to < 0 || to >= macro.steps.length || from === to) return;
    edit({ type: 'move', stepId: macro.steps[from]!.id, to });
    focusSoon(...focus);
    setAnnounce(`Moved step ${from + 1} to position ${to + 1}.`);
  };

  // Closes the ⋯ menu a button sits in; the step it belongs to may stay on screen.
  const closeMenu = (el: HTMLElement) => (el.closest('[popover]') as HTMLElement | null)?.hidePopover?.();

  return (
    <section aria-label={`Edit ${macro.name}`} className="flex max-w-4xl min-w-0 flex-1 flex-col gap-6 px-8 py-6">
      <div className="flex flex-col gap-3">
        <input
          aria-label="Macro name"
          className="field -ml-2.5 h-10 border-transparent bg-transparent px-2.5 text-lg font-semibold hover:border-line-strong"
          value={macro.name}
          onChange={(e) => settings({ name: e.target.value })}
        />
        <div className="flex flex-wrap items-end gap-6">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Wait between steps (seconds)
            <input
              type="number"
              min={0}
              step={0.1}
              className="field w-30 text-sm font-normal"
              value={macro.delayMs / 1000}
              onChange={(e) => {
                const s = e.target.valueAsNumber;
                if (Number.isFinite(s) && s >= 0) settings({ delayMs: Math.round(s * 1000) });
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Times to play
            <input
              type="number"
              min={1}
              step={1}
              className="field w-22 text-sm font-normal disabled:opacity-50"
              disabled={macro.loop}
              value={macro.runs}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (Number.isInteger(n) && n >= 1) settings({ runs: n });
              }}
            />
          </label>
          <label className="flex h-8 items-center gap-2">
            <input type="checkbox" checked={macro.loop} onChange={(e) => settings({ loop: e.target.checked })} />
            Keep repeating until I press Stop
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <h2 id="steps-title" tabIndex={-1} className="text-sm font-bold">
            Steps
          </h2>
          <p className="text-xs text-muted">Drag to reorder, or use the arrows.</p>
        </div>
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
        {macro.steps.length === 0 && <p className="text-muted">This macro has no steps.</p>}
        <ol className="rows overflow-visible">
          {macro.steps.map((step, i) => (
            <li
              key={step.id}
              className={dragFrom === i ? 'opacity-50' : ''}
              onDragOver={(e) => dragFrom !== null && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) move(dragFrom, i);
                setDragFrom(null);
              }}
            >
              <div className="group flex min-h-11 items-center gap-2.5 px-2 hover:bg-subtle">
                <span
                  draggable
                  aria-hidden
                  title="Drag to move"
                  className="cursor-grab text-faint select-none"
                  onDragStart={(e) => {
                    setDragFrom(i);
                    e.dataTransfer.effectAllowed = 'move';
                    const row = e.currentTarget.parentElement;
                    if (row) e.dataTransfer.setDragImage(row, 10, 10);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                >
                  <Grip />
                </span>
                <span className="w-5 text-right text-xs text-faint tabular-nums">{i + 1}</span>
                <span className="w-18 shrink-0 rounded bg-raised px-1.5 py-0.5 text-center text-[11px] font-medium text-muted">{ACTION[step.action]}</span>
                <span className="track-label min-w-0 flex-1 truncate" title={step.label}>
                  {step.label || 'Untitled step'}
                </span>
                {/* Faint until the row is pointed at or focused, but always readable. */}
                <span className="flex gap-0.5 text-faint group-focus-within:text-ink group-hover:text-ink">
                  <button id={`up-${step.id}`} className="btn btn-ghost btn-icon text-inherit" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1, [`up-${step.id}`, `down-${step.id}`])}>
                    <Up />
                  </button>
                  <button
                    id={`down-${step.id}`}
                    className="btn btn-ghost btn-icon text-inherit"
                    aria-label={`Move step ${i + 1} down`}
                    disabled={i === macro.steps.length - 1}
                    onClick={() => move(i, i + 1, [`down-${step.id}`, `up-${step.id}`])}
                  >
                    <Down />
                  </button>
                  <button
                    id={`edit-btn-${step.id}`}
                    className="btn btn-ghost text-inherit"
                    aria-label={`Edit step ${i + 1}`}
                    aria-expanded={open === step.id}
                    aria-controls={`edit-${step.id}`}
                    onClick={() => setOpen(open === step.id ? null : step.id)}
                  >
                    {open === step.id ? 'Done' : 'Edit'}
                  </button>
                  <button className="btn btn-ghost btn-icon text-inherit" aria-label={`More for step ${i + 1}`} popoverTarget={`menu-${step.id}`}>
                    <More />
                  </button>
                  <div id={`menu-${step.id}`} popover="auto" className="menu">
                    <button
                      className="btn btn-ghost w-full justify-start text-ink"
                      aria-label={`Duplicate step ${i + 1}`}
                      onClick={(e) => {
                        closeMenu(e.currentTarget);
                        edit({ type: 'duplicate', stepId: step.id, newId: crypto.randomUUID() });
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      className="btn btn-ghost btn-danger w-full justify-start"
                      aria-label={`Delete step ${i + 1}`}
                      onClick={(e) => {
                        closeMenu(e.currentTarget);
                        if (!confirm(`Delete step ${i + 1}, "${step.label}"?`)) return;
                        const near = macro.steps[i + 1] ?? macro.steps[i - 1];
                        edit({ type: 'delete-step', stepId: step.id });
                        focusSoon(near ? `edit-btn-${near.id}` : 'steps-title');
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </span>
              </div>
              {open === step.id && (
                <div id={`edit-${step.id}`} className="border-t bg-subtle py-4 pr-4 pl-18">
                  <StepFields step={step} change={(patch) => edit({ type: 'step', stepId: step.id, patch })} />
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
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
          <Download />
          Save to a file
        </button>
        <button className="btn btn-ghost btn-danger" onClick={() => confirm(`Delete "${macro.name}"? This can't be undone.`) && remove()}>
          <Trash />
          Delete this macro
        </button>
      </div>
    </section>
  );
}

function StepFields({ step, change }: { step: Step; change: (patch: Partial<Step>) => void }) {
  const text = (label: string, value: string, set: (v: string) => void, type = 'text') => (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
      {label}
      <input type={type} className="field text-sm font-normal text-ink" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
  return (
    <div className="flex flex-col gap-3">
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
          <legend className="mb-1.5 text-xs font-medium text-muted">How to find it on the page</legend>
          <p className="text-xs text-muted">
            Tried from top to bottom until one matches. CSS selector and XPath are only used when no other way is listed, because they can point at
            the wrong thing after a page changes. Easier: play the macro and use "Pick it on the page" when a step fails.
          </p>
          {step.locators.map((l, j) => (
            <div key={j} className="flex gap-1.5">
              <select
                aria-label={`Way ${j + 1}: type`}
                className="field w-40"
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
                className="field flex-1 font-mono text-xs"
                value={l.value}
                onChange={(e) => change({ locators: step.locators.with(j, { ...l, value: e.target.value }) })}
              />
              <button
                id={`loc-rm-${step.id}-${j}`}
                className="btn btn-ghost btn-icon h-8 w-8"
                aria-label={`Remove way ${j + 1}`}
                onClick={() => {
                  change({ locators: step.locators.toSpliced(j, 1) });
                  // The next way slides into this slot.
                  focusSoon(`loc-rm-${step.id}-${j + 1 < step.locators.length ? j : j - 1}`, `loc-add-${step.id}`);
                }}
              >
                <Close />
              </button>
            </div>
          ))}
          <button id={`loc-add-${step.id}`} className="btn btn-ghost self-start px-1" onClick={() => change({ locators: [...step.locators, { kind: 'text', value: '' }] })}>
            + Add a way to find it
          </button>
        </fieldset>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Options />);
