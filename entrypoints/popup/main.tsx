import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recording, type Recording } from '../../src/bg/recording';
import type { ToBackground } from '../background';
import '../../assets/tailwind.css';

const send = (msg: ToBackground) => browser.runtime.sendMessage(msg);

function Popup() {
  const [rec, setRec] = useState<Recording | null>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void recording.getValue().then(setRec);
    return recording.watch(setRec);
  }, []);

  const start = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined && (await send({ type: 'start', tabId: tab.id, hover }))) window.close();
    else setError("This page can't be recorded. Open a website, or reload this page and try again.");
  };

  return (
    <main className="w-64 p-4 flex flex-col gap-3">
      <h1 className="font-semibold">Easy Web Macros</h1>
      {rec ? (
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
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        </>
      )}
      <p className="text-xs text-neutral-500">Shortcut: Alt+Shift+R (Option+Shift+R on Mac) starts or stops recording.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
