import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recording, type Recording } from '../../src/bg/recording';
import { run as runItem, type Run } from '../../src/bg/replay';
import { lastRuns as lastRunsItem, macros as macrosItem, rating as ratingItem, speed as speedItem, type LastRun } from '../../src/bg/state';
import type { Macro } from '../../src/core/macro';
import { markAsked, nextPrompt, NO_RATING, type Prompt } from '../../src/core/rating';
import { Back, Check, Chevron, Close, Edit, Gear, Logo, Play, SHORTCUT, Star, Stop } from '../../src/ui/icons';
import { RunView } from '../../src/ui/RunView';
import type { ToBackground } from '../background';
import '../../assets/tailwind.css';

const send = (msg: ToBackground) => browser.runtime.sendMessage(msg);
const REVIEW_URL = 'https://chromewebstore.google.com/detail/cmpjcbhhaneoeekleibpfoejfieblekk/reviews';
const ISSUES_URL = 'https://github.com/epulla/easy-web-macros-v2/issues';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function ago(at: number) {
  const mins = Math.round((at - Date.now()) / 60_000);
  if (mins > -1) return 'just now';
  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });
  if (mins > -60) return fmt.format(mins, 'minute');
  if (mins > -1440) return fmt.format(Math.round(mins / 60), 'hour');
  return fmt.format(Math.round(mins / 1440), 'day');
}

function LastPlay({ last }: { last?: LastRun }) {
  if (!last) return <span>Not played yet</span>;
  return last.ok ? (
    <span className="inline-flex items-center gap-1">
      <Check />
      Worked {ago(last.at)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-rec-ink">
      <Close />
      Stopped at step {last.step} · {ago(last.at)}
    </span>
  );
}

const SPEEDS = [
  [0.5, 'Slow'],
  [1, 'Normal'],
  [2, 'Fast'],
  [4, 'Fastest'],
] as const;

function Popup() {
  const [rec, setRec] = useState<Recording | null>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [lastRuns, setLastRuns] = useState<Record<string, LastRun>>({});
  const [speed, setSpeed] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [rating, setRating] = useState(NO_RATING);
  const [prompt, setPrompt] = useState<Prompt>('waiting');
  const [settings, setSettings] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([recording.getValue(), runItem.getValue()]).then(([rec, current]) => {
      setRec(rec);
      setRun(current);
      setLoaded(true);
    });
    void macrosItem.getValue().then(setMacros);
    void lastRunsItem.getValue().then(setLastRuns);
    void speedItem.getValue().then(setSpeed);
    void ratingItem.getValue().then(setRating);
    const unwatch = [
      recording.watch(setRec),
      runItem.watch(setRun),
      macrosItem.watch(setMacros),
      lastRunsItem.watch(setLastRuns),
      ratingItem.watch(setRating),
    ];
    return () => unwatch.forEach((u) => u());
  }, []);

  const idle = loaded && !rec && !run;
  useEffect(() => {
    const next = nextPrompt(prompt, rating, idle);
    if (next === prompt) return;
    setPrompt(next);
    // Showing the prompt uses up one of the two asks.
    if (next === 'showing') void ratingItem.getValue().then((r) => ratingItem.setValue(markAsked(r)));
  }, [prompt, rating, idle]);

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

  const neverAsk = async () => ratingItem.setValue({ ...(await ratingItem.getValue()), done: true });
  const rate = async () => {
    await neverAsk();
    void browser.tabs.create({ url: REVIEW_URL });
    window.close();
  };

  const showSettings = settings && !rec && !run;

  return (
    <main className="w-[372px]">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        {showSettings ? (
          <>
            <button className="btn btn-ghost btn-icon -ml-2" aria-label="Back to your macros" onClick={() => setSettings(false)}>
              <Back />
            </button>
            <h1 className="flex-1 font-semibold">Settings</h1>
          </>
        ) : (
          <>
            <Logo />
            <h1 className="flex-1 font-semibold">Easy Web Macros</h1>
            {!rec && !run && (
              <button className="btn btn-ghost btn-icon -mr-2" aria-label="Settings" onClick={() => setSettings(true)}>
                <Gear />
              </button>
            )}
          </>
        )}
      </header>
      <div className="flex flex-col gap-4 p-4">
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
            <div role="status" className="flex items-center gap-3">
              <span aria-hidden className="dot pulse" />
              <div>
                <p className="text-sm font-semibold">Recording</p>
                <p className="text-xs text-muted">{plural(rec.steps.length, 'step')} so far</p>
              </div>
            </div>
            <p className="text-muted">Use the website as usual. Every click and entry becomes a step.</p>
            {rec.steps.length > 0 && (
              <ol className="rows max-h-48 overflow-y-auto" aria-label="Recorded steps">
                {rec.steps.map((step) => (
                  <li key={step.id} className="step">
                    <span aria-hidden className="step-icon">
                      <Check />
                    </span>
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{step.label}</span>
                  </li>
                ))}
              </ol>
            )}
            <button
              className="btn btn-primary btn-lg"
              onClick={() => send({ type: 'stop' }).then(() => setError(''), () => setError("Couldn't save the macro. Your steps are kept; try Stop and save again."))}
            >
              <Stop />
              Stop and save
            </button>
            {rec.name && (
              <p className="-mt-2 text-center text-xs text-muted">
                Will be saved as <strong className="font-medium text-ink">{rec.name}</strong>. You can rename it later.
              </p>
            )}
            {error && <p role="alert" className="text-rec-ink">{error}</p>}
          </>
        ) : showSettings ? (
          <div className="flex flex-col gap-4">
            <fieldset className="flex items-center justify-between gap-4">
              <legend className="float-left font-medium">Playback speed</legend>
              <div className="segmented">
                {SPEEDS.map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="speed"
                      className="sr-only"
                      checked={speed === value}
                      onChange={() => {
                        setSpeed(value);
                        void speedItem.setValue(value);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <hr />
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium">Record pointing at things</span>
                <span className="block text-xs text-muted">Also save a step when you rest the pointer on a menu or button.</span>
              </span>
              <input type="checkbox" role="switch" className="switch" checked={hover} onChange={(e) => setHover(e.target.checked)} />
            </label>
            <hr />
            <div className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium">Start or stop recording</span>
                <span className="block text-xs text-muted">Keyboard shortcut</span>
              </span>
              <kbd className="kbd">{SHORTCUT}</kbd>
            </div>
            <hr />
            <div className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium">Edit macros</span>
                <span className="block text-xs text-muted">Rename, reorder or fix steps, save to a file.</span>
              </span>
              <button className="btn" onClick={() => edit()}>
                Open editor
              </button>
            </div>
          </div>
        ) : (
          <>
            <button className="btn btn-lg justify-start gap-2.5" onClick={() => void start()} aria-keyshortcuts={SHORTCUT.replace('Option', 'Alt')}>
              <span aria-hidden className="dot" />
              <span className="flex-1 text-left">Record</span>
              <kbd className="kbd" aria-hidden>
                {SHORTCUT}
              </kbd>
            </button>
            {macros.length === 0 ? (
              <p className="text-muted">Press Record, then use the website as usual. Come back here and press Stop and save when you're done.</p>
            ) : (
              <section aria-labelledby="macros-title" className="flex flex-col gap-2">
                <h2 id="macros-title" className="section-title">
                  Your macros · {macros.length}
                </h2>
                <ul className="rows max-h-96 overflow-y-auto">
                  {macros.map((m) => (
                    <li key={m.id}>
                      <div className="flex items-center gap-2 py-2 pr-2 pl-1 hover:bg-subtle">
                        <button
                          className={`btn btn-ghost btn-icon text-faint ${open === m.id ? '[&_svg]:rotate-90' : ''}`}
                          aria-label={`Steps in ${m.name}`}
                          aria-expanded={open === m.id}
                          aria-controls={`steps-${m.id}`}
                          onClick={() => setOpen(open === m.id ? null : m.id)}
                        >
                          <Chevron />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-medium [overflow-wrap:anywhere]" title={m.name}>
                            {m.name}
                          </p>
                          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs whitespace-nowrap text-muted">
                            <span>{plural(m.steps.length, 'step')}</span>
                            <LastPlay last={lastRuns[m.id]} />
                          </p>
                        </div>
                        <button className="btn btn-ghost btn-icon" aria-label={`Edit ${m.name}`} onClick={() => edit(m.id)}>
                          <Edit />
                        </button>
                        <button className="btn btn-primary" aria-label={`Play ${m.name}`} onClick={() => void play(m.id)}>
                          <Play />
                          Play
                        </button>
                      </div>
                      {open === m.id && (
                        <ol id={`steps-${m.id}`} className="max-h-48 overflow-y-auto border-t bg-subtle py-1 pr-2 pl-9">
                          {m.steps.map((step, i) => (
                            <li key={step.id} className="group flex h-7 items-center gap-2 text-xs">
                              <span className="w-4 text-right text-faint tabular-nums">{i + 1}</span>
                              <span className="min-w-0 flex-1 truncate" title={step.label}>
                                {step.label}
                              </span>
                              <button
                                className="btn btn-ghost h-6 px-2 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                                aria-label={`Play ${m.name} from step ${i + 1}`}
                                onClick={() => void play(m.id, i)}
                              >
                                Play from here
                              </button>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {prompt === 'showing' && (
              <section aria-labelledby="rate-title" className="card">
                <h2 id="rate-title" className="font-semibold">
                  Is Easy Web Macros saving you time?
                </h2>
                <p className="text-xs text-muted">A quick rating on the Chrome Web Store helps other people find it.</p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-primary" onClick={() => void rate()}>
                    <Star />
                    Rate it
                  </button>
                  <button className="btn" onClick={() => setPrompt('closed')}>
                    Not now
                  </button>
                  <button className="btn btn-ghost" onClick={() => void neverAsk()}>
                    Don't ask again
                  </button>
                </div>
                <a className="text-xs text-muted underline underline-offset-2" href={ISSUES_URL} target="_blank" rel="noreferrer">
                  Something's not working? Tell us instead.
                </a>
              </section>
            )}
            {error && <p role="alert" className="text-rec-ink">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
