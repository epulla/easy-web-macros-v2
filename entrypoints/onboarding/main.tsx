import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/tailwind.css';

const STEPS = [
  ['Record', 'Click the Easy Web Macros icon in your toolbar and press Record. Don\'t see it? Click the puzzle piece icon and pin Easy Web Macros.'],
  ['Do it once', 'Use the website as usual: click, type, choose from lists. Every action becomes a step. Then open the icon again and press Stop and save.'],
  ['Play it back', 'Press Play next to your macro. You see each step as it plays. If one gets stuck, you get a plain explanation and can try again, skip it, or point at the right thing on the page.'],
];

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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <div aria-hidden className="flex gap-6">
          <span className="reel spin size-10" />
          <span className="reel spin size-10" />
        </div>
        <h1 className="text-2xl font-semibold">{whatsNew ? "What's new in Easy Web Macros 2" : 'Welcome to Easy Web Macros'}</h1>
        <p className="text-muted">Record what you do on a website once. Play it back with one click.</p>
      </header>

      {whatsNew && (
        <section aria-labelledby="new-title" className="cassette flex flex-col gap-2 p-4">
          <h2 id="new-title" className="font-semibold">
            What changed
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {NEW.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="how-title" className="flex flex-col gap-2">
        <h2 id="how-title" className="font-semibold">
          How it works
        </h2>
        <ol className="tracks">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="track items-start py-2">
              <span className="track-no pt-0.5">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <strong className="block">{title}</strong>
                {text}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-1 text-sm text-muted">
        <p>Tip: press Alt+Shift+R (Option+Shift+R on Mac) to start or stop recording.</p>
        <p>Tabs that were open before you installed this need a reload before you can record in them.</p>
        <p>Your macros stay on this computer. Nothing is sent anywhere.</p>
      </section>

      <div className="flex justify-center">
        <button className="key" onClick={() => void browser.runtime.openOptionsPage()}>
          See your macros
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Onboarding />);
