import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recording, type Recording } from '../../src/bg/recording';
import { run as runItem, type Run } from '../../src/bg/replay';
import { macros as macrosItem, speed as speedItem } from '../../src/bg/state';
import type { Macro } from '../../src/core/macro';
import { RunView } from '../../src/ui/RunView';
import type { ToBackground } from '../background';
import '../../assets/tailwind.css';

const send = (msg: ToBackground) => browser.runtime.sendMessage(msg);

function Popup() {
  const [rec, setRec] = useState<Recording | null>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    void recording.getValue().then(setRec);
    void runItem.getValue().then(setRun);
    void macrosItem.getValue().then(setMacros);
    void speedItem.getValue().then(setSpeed);
    const unwatch = [recording.watch(setRec), runItem.watch(setRun), macrosItem.watch(setMacros)];
    return () => unwatch.forEach((u) => u());
  }, []);

  const activeTab = async () => (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;

  const start = async () => {
    const tabId = await activeTab();
    if (tabId !== undefined && (await send({ type: 'start', tabId, hover }))) window.close();
    else setError("This page can't be recorded. Open a website, or reload this page and try again.");
  };

  const play = async (macroId: string, from = 0) => {
    const tabId = await activeTab();
    setError('');
    if (tabId === undefined || !(await send({ type: 'play', macroId, tabId, from, speed }))) setError("Couldn't start this macro. Try again.");
  };

  return (
    <main className="w-80 p-4 flex flex-col gap-3">
      <h1 className="font-semibold">Easy Web Macros</h1>
      {run && !rec ? (
        <RunView
          run={run}
          act={{
            pause: () => void send({ type: 'pause' }),
            resume: () => void send({ type: 'resume' }),
            stop: () => void send({ type: 'stop-run' }),
            skip: () => void send({ type: 'skip' }),
            proceed: (value) => void send({ type: 'proceed', value }),
            // Closing the popup lets the click reach the page.
            pick: () => void send({ type: 'pick' }).then(() => window.close()),
          }}
        />
      ) : rec ? (
        <>
          <p role="status" className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-full bg-rose-600" />
            Recording · {rec.steps.length} {rec.steps.length === 1 ? 'step' : 'steps'}
          </p>
          <button
            className="rounded bg-neutral-900 px-3 py-2 text-white"
            onClick={() => send({ type: 'stop' }).then(() => setError(''), () => setError("Couldn't save the macro. Your steps are kept; try Stop and save again."))}
          >
            Stop and save
          </button>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        </>
      ) : (
        <>
          <button className="flex items-center justify-center gap-2 rounded bg-neutral-900 px-3 py-2 text-white" onClick={() => void start()}>
            <span aria-hidden className="size-2.5 rounded-full bg-rose-600" />
            Record
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hover} onChange={(e) => setHover(e.target.checked)} />
            Also record when I rest the pointer on something
          </label>
          {macros.length > 0 && (
            <section className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
              <label className="flex items-center gap-2 text-sm">
                Speed
                <select
                  className="rounded border border-neutral-300 px-1 py-0.5"
                  value={speed}
                  onChange={(e) => {
                    setSpeed(Number(e.target.value));
                    void speedItem.setValue(Number(e.target.value));
                  }}
                >
                  <option value={0.5}>Slow (half speed)</option>
                  <option value={1}>Normal</option>
                  <option value={2}>Fast (2×)</option>
                  <option value={4}>Fastest (4×)</option>
                </select>
              </label>
              <ul aria-label="Your macros" className="flex flex-col gap-1">
                {macros.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-2 text-sm">
                    <details className="min-w-0 flex-1">
                      <summary className="cursor-pointer truncate">{m.name}</summary>
                      <ol className="mt-1 flex max-h-48 flex-col gap-1 overflow-y-auto">
                        {m.steps.map((step, i) => (
                          <li key={step.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {i + 1}. {step.label}
                            </span>
                            <button
                              className="btn shrink-0"
                              aria-label={`Play ${m.name} from step ${i + 1}`}
                              onClick={() => void play(m.id, i)}
                            >
                              From here
                            </button>
                          </li>
                        ))}
                      </ol>
                    </details>
                    <button className="btn shrink-0" aria-label={`Play ${m.name}`} onClick={() => void play(m.id)}>
                      ▶ Play
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        </>
      )}
      <p className="text-xs text-neutral-500">Shortcut: Alt+Shift+R (Option+Shift+R on Mac) starts or stops recording.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
