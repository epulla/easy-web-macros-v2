import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recording, type Recording } from '../../src/bg/recording';
import { run as runItem, type Run } from '../../src/bg/replay';
import { macros as macrosItem } from '../../src/bg/state';
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

  useEffect(() => {
    void recording.getValue().then(setRec);
    void runItem.getValue().then(setRun);
    void macrosItem.getValue().then(setMacros);
    const unwatch = [recording.watch(setRec), runItem.watch(setRun), macrosItem.watch(setMacros)];
    return () => unwatch.forEach((u) => u());
  }, []);

  const activeTab = async () => (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;

  const start = async () => {
    const tabId = await activeTab();
    if (tabId !== undefined && (await send({ type: 'start', tabId, hover }))) window.close();
    else setError("This page can't be recorded. Open a website, or reload this page and try again.");
  };

  const play = async (macroId: string) => {
    const tabId = await activeTab();
    setError('');
    if (tabId === undefined || !(await send({ type: 'play', macroId, tabId }))) setError("Couldn't start this macro. Try again.");
  };

  return (
    <main className="w-80 p-4 flex flex-col gap-3">
      <h1 className="font-semibold">Easy Web Macros</h1>
      {run && !rec ? (
        <RunView
          run={run}
          onPause={() => void send({ type: 'pause' })}
          onResume={() => void send({ type: 'resume' })}
          onStop={() => void send({ type: 'stop-run' })}
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
            <ul aria-label="Your macros" className="flex flex-col gap-1 border-t border-neutral-200 pt-3">
              {macros.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{m.name}</span>
                  <button className="btn shrink-0" aria-label={`Play ${m.name}`} onClick={() => void play(m.id)}>
                    ▶ Play
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        </>
      )}
      <p className="text-xs text-neutral-500">Shortcut: Alt+Shift+R (Option+Shift+R on Mac) starts or stops recording.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
