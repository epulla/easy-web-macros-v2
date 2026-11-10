import React from 'react';
import { createRoot } from 'react-dom/client';
import { Check, Keyboard, Lock, Mascot, Pin, Reload, SHORTCUT } from '../../src/ui/icons';
import '../../assets/tailwind.css';

const STEPS = [
  ['Record', 'Click the Easy Web Macros icon in your toolbar and press Record.'],
  ['Do it once', 'Click, type and choose as usual. Every action becomes a step. Then press Stop and save.'],
  ['Play it back', 'Press Play. If a step gets stuck, try again, skip it, or point at the right thing on the page.'],
];

const NOTES = [
  [Pin, "Don't see the icon? Click the puzzle piece in the toolbar and pin Easy Web Macros."],
  [Keyboard, `Press ${SHORTCUT} to start or stop recording.`],
  [Reload, 'Tabs that were open before you installed this need a reload before you can record in them.'],
  [Lock, 'Your macros stay on this computer. Nothing is sent anywhere.'],
] as const;

const NEW = [
  'Your macros from the old version are already here.',
  'Records more of what you do: double-clicks, typing, lists, tick boxes, keys, file uploads, scrolling, and new tabs.',
  'Finds the right button or field even when the page changes a little.',
  'Shows every step while it plays, and tells you in plain words when something goes wrong.',
  'Never stores passwords: it asks you each time instead.',
  'Edit your macros: rename them, change the order of steps, fix or remove a step.',
  'Choose the playback speed, or start from any step.',
  'Save a macro to a file to share it or keep a copy.',
];

function Onboarding() {
  const whatsNew = location.hash === '#whats-new';
  return (
    <main className="mx-auto flex max-w-170 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <Mascot />
        <h1 className="text-[26px] font-extrabold tracking-tight">{whatsNew ? "What's new in Easy Web Macros 2" : 'Welcome to Easy Web Macros'}</h1>
        <p className="text-[15px] text-muted">Record what you do on a website once. Play it back with one click.</p>
      </header>

      {whatsNew && (
        <section aria-labelledby="new-title" className="flex flex-col gap-3 rounded-[10px] border p-4">
          <h2 id="new-title" className="text-sm font-bold">
            What changed
          </h2>
          <ul className="flex flex-col gap-2">
            {NEW.map((item) => (
              <li key={item} className="flex gap-2.5 text-muted">
                <span className="mt-0.5 text-accent-ink">
                  <Check />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="how-title" className="flex flex-col gap-3">
        <h2 id="how-title" className={whatsNew ? 'text-sm font-bold' : 'sr-only'}>
          How it works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex flex-col gap-2 rounded-[10px] border p-4">
              <span aria-hidden className="grid size-5.5 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">
                {i + 1}
              </span>
              <h3 className="text-sm font-bold">{title}</h3>
              <p className="text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <ul className="flex flex-col gap-2.5 rounded-[10px] border p-4 text-muted">
        {NOTES.map(([Icon, text]) => (
          <li key={text} className="flex items-start gap-2.5">
            <span className="mt-0.5 text-faint">
              <Icon />
            </span>
            {text}
          </li>
        ))}
      </ul>

      <div className="flex justify-center">
        <button className="btn btn-primary btn-lg" onClick={() => void browser.runtime.openOptionsPage()}>
          See your macros
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Onboarding />);
