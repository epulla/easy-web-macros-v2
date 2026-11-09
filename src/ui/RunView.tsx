import React, { useState } from 'react';
import type { Run, StepStatus } from '../bg/replay';

const STATUS: Record<StepStatus, string> = {
  pending: 'Waiting',
  running: 'Playing now',
  done: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
};

const HEADLINE: Record<Run['state'], string> = {
  running: 'Playing',
  paused: 'Paused',
  failed: 'Stopped at a problem',
  waiting: 'Needs you',
  picking: 'Waiting for your click',
  done: 'Finished',
};

// Messages mark names with **bold**.
const rich = (text: string) => text.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));

export interface RunActions {
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skip: () => void;
  proceed: (value?: string) => void;
  pick: () => void;
}

export function RunView({ run, act }: { run: Run; act: RunActions }) {
  const [password, setPassword] = useState('');
  const step = run.steps[run.index];
  const asksPassword = run.state === 'waiting' && step?.action === 'type';
  const rounds = run.loop ? ` · run ${run.round}` : run.runs > 1 ? ` · run ${run.round} of ${run.runs}` : '';
  const position = run.state === 'done' ? '' : ` · step ${Math.min(run.index + 1, run.steps.length)} of ${run.steps.length}`;
  return (
    <section className="flex flex-col gap-3" aria-label={`Playing ${run.name}`}>
      <div className="lcd">
        <p role="status" className="flex items-center gap-2">
          <span aria-hidden>{run.state === 'running' ? '▶' : run.state === 'done' ? '■' : run.state === 'paused' ? '❚❚' : '!'}</span>
          {HEADLINE[run.state]}
          {position}
          {rounds}
        </p>
        <p className="truncate text-xs opacity-80">{run.name}</p>
      </div>
      <ol className="tracks max-h-64 overflow-y-auto" aria-label="Steps">
        {run.steps.map((step, i) => (
          <li key={step.id} className="track" data-status={run.status[i]} aria-current={run.status[i] === 'running' ? 'step' : undefined}>
            <span className="track-no">{String(i + 1).padStart(2, '0')}</span>
            <span className="sr-only">{STATUS[run.status[i]!]}:</span>
            <span className="track-label min-w-0 flex-1">{step.label}</span>
            {run.status[i] === 'done' && <span aria-hidden className="text-ok">✓</span>}
            {run.status[i] === 'failed' && <span aria-hidden>✕</span>}
          </li>
        ))}
      </ol>
      {run.message && (
        <p role="alert" className={`text-sm ${run.state === 'failed' ? 'text-rec' : 'text-warn'}`}>
          {rich(run.message)}
        </p>
      )}
      {asksPassword && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act.proceed(password);
            setPassword('');
          }}
        >
          <input
            type="password"
            aria-label="Password"
            autoComplete="off"
            autoFocus
            className="field min-w-0 flex-1 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn">Type it</button>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        {run.state === 'running' && (
          <button className="key key-sm" onClick={act.pause}>
            <span aria-hidden>❚❚</span>
            Pause
          </button>
        )}
        {run.state === 'paused' && (
          <button className="key key-sm" onClick={act.resume}>
            <span aria-hidden>▶</span>
            Continue
          </button>
        )}
        {run.state === 'waiting' && step?.action === 'upload' && (
          <button className="key key-sm" onClick={() => act.proceed()}>
            <span aria-hidden>▶</span>
            Continue
          </button>
        )}
        {(run.state === 'failed' || run.state === 'picking') && (
          <button className="key key-sm" onClick={act.resume}>
            <span aria-hidden>↻</span>
            Try again
          </button>
        )}
        {run.state === 'failed' && step?.action !== 'navigate' && (
          <button className="btn" onClick={act.pick} title="Click the right item on the page; the macro remembers it">
            Pick it on the page
          </button>
        )}
        {step && ['failed', 'waiting', 'paused', 'picking'].includes(run.state) && (
          <button className="btn" onClick={act.skip}>
            Skip this step
          </button>
        )}
        <button className="key key-sm" onClick={act.stop}>
          <span aria-hidden>■</span>
          {run.state === 'done' ? 'Close' : 'Stop'}
        </button>
      </div>
    </section>
  );
}
