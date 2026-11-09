import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recording, type Recording } from '../../src/bg/recording';
import { run as runItem, type Run } from '../../src/bg/replay';
import { lastRuns as lastRunsItem, macros as macrosItem, speed as speedItem, type LastRun } from '../../src/bg/state';
import type { Macro } from '../../src/core/macro';
import { RunView } from '../../src/ui/RunView';
import type { ToBackground } from '../background';
import '../../assets/tailwind.css';

const send = (msg: ToBackground) => browser.runtime.sendMessage(msg);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function ago(at: number) {
  const mins = Math.round((at - Date.now()) / 60_000);
  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (mins > -60) return fmt.format(mins, 'minute');
  if (mins > -1440) return fmt.format(Math.round(mins / 60), 'hour');
  return fmt.format(Math.round(mins / 1440), 'day');
}

function LastPlay({ last }: { last?: LastRun }) {
  if (!last) return <>Not played yet</>;
  return last.ok ? (
    <span className="text-ok">Last play worked · {ago(last.at)}</span>
  ) : (
    <span className="text-rec">Last play stopped at step {last.step} · {ago(last.at)}</span>
  );
}

function Popup() {
  const [rec, setRec] = useState<Recording | null>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [lastRuns, setLastRuns] = useState<Record<string, LastRun>>({});
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    void recording.getValue().then(setRec);
    void runItem.getValue().then(setRun);
    void macrosItem.getValue().then(setMacros);
    void lastRunsItem.getValue().then(setLastRuns);
    void speedItem.getValue().then(setSpeed);
    const unwatch = [recording.watch(setRec), runItem.watch(setRun), macrosItem.watch(setMacros), lastRunsItem.watch(setLastRuns)];
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

  const edit = (macroId?: string) => {
    void browser.tabs.create({ url: browser.runtime.getURL(`/options.html${macroId ? `#${macroId}` : ''}`) });
    window.close();
  };

  const moving = !!rec || run?.state === 'running';

  return (
    <main className="flex w-80 flex-col gap-3 p-3">
      <header className="flex items-center gap-2">
        <span aria-hidden className={`reel ${moving ? 'spin' : ''}`} />
        <h1 className="flex-1 text-center font-semibold tracking-wide">Easy Web Macros</h1>
        <span aria-hidden className={`reel ${moving ? 'spin' : ''}`} />
      </header>
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
          <p role="status" className="lcd flex items-center gap-2">
            <span aria-hidden className="dot blink" />
            Recording · {plural(rec.steps.length, 'step')}
          </p>
          <p className="text-sm text-muted">Use the website as usual. Every click and entry becomes a step.</p>
          <button
            className="key"
            onClick={() => send({ type: 'stop' }).then(() => setError(''), () => setError("Couldn't save the macro. Your steps are kept; try Stop and save again."))}
          >
            <span aria-hidden>■</span>
            Stop and save
          </button>
          {error && <p role="alert" className="text-sm text-rec">{error}</p>}
        </>
      ) : (
        <>
          <p role="status" className="lcd">
            {macros.length ? `Ready · ${plural(macros.length, 'macro')}` : 'Ready to record'}
          </p>
          <button className="key" onClick={() => void start()}>
            <span aria-hidden className="dot" />
            Record
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hover} onChange={(e) => setHover(e.target.checked)} />
            Also record when I rest the pointer on something
          </label>
          {macros.length === 0 ? (
            <p className="text-sm text-muted">Press Record, then use the website as usual. Come back here and press Stop and save when you're done.</p>
          ) : (
            <section aria-labelledby="macros-title" className="flex flex-col gap-2 border-t pt-3">
              <div className="flex items-center justify-between gap-2">
                <h2 id="macros-title" className="text-sm font-semibold">Your macros</h2>
                <label className="flex items-center gap-1 text-xs text-muted">
                  Speed
                  <select
                    className="field py-0.5 text-xs"
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
              </div>
              <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {macros.map((m) => (
                  <li key={m.id} className="cassette flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="truncate text-xs text-muted">
                          {plural(m.steps.length, 'step')} · <LastPlay last={lastRuns[m.id]} />
                        </p>
                      </div>
                      <button className="key key-sm" aria-label={`Play ${m.name}`} onClick={() => void play(m.id)}>
                        <span aria-hidden>▶</span>
                        Play
                      </button>
                    </div>
                    <div className="flex items-start gap-2">
                      <details className="min-w-0 flex-1 text-xs">
                        <summary className="cursor-pointer text-muted">
                          Steps<span className="sr-only"> in {m.name}</span>
                        </summary>
                        <ol className="tracks mt-1 max-h-48 overflow-y-auto">
                          {m.steps.map((step, i) => (
                            <li key={step.id} className="track">
                              <span className="track-no">{String(i + 1).padStart(2, '0')}</span>
                              <span className="track-label min-w-0 flex-1 truncate">{step.label}</span>
                              <button className="btn shrink-0 py-0 text-xs" aria-label={`Play ${m.name} from step ${i + 1}`} onClick={() => void play(m.id, i)}>
                                From here
                              </button>
                            </li>
                          ))}
                        </ol>
                      </details>
                      <button className="btn py-0 text-xs" aria-label={`Edit ${m.name}`} onClick={() => edit(m.id)}>
                        Edit
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {error && <p role="alert" className="text-sm text-rec">{error}</p>}
        </>
      )}
      <p className="border-t pt-2 text-xs text-muted">Shortcut: Alt+Shift+R (Option+Shift+R on Mac) starts or stops recording.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
