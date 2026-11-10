import React, { useState } from 'react';
import type { Run, StepStatus } from '../bg/replay';
import { Alert, Check, Close, Pause, Play, Retry, Skip, Stop, Target } from './icons';

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

const ICON: Record<StepStatus, React.ReactNode> = {
  pending: <span className="pending" />,
  running: <span className="spinner" />,
  done: <Check />,
  failed: <Close />,
  skipped: <Skip />,
};

export function RunView({ run, act }: { run: Run; act: RunActions }) {
  const [password, setPassword] = useState('');
  const step = run.steps[run.index];
  const asksPassword = run.state === 'waiting' && step?.action === 'type';
  const rounds = run.loop ? ` · run ${run.round}` : run.runs > 1 ? ` · run ${run.round} of ${run.runs}` : '';
  const position = run.state === 'done' ? '' : ` · step ${Math.min(run.index + 1, run.steps.length)} of ${run.steps.length}`;
  const done = run.status.filter((s) => s !== 'pending' && s !== 'running').length;
  const canSkip = !!step && ['failed', 'waiting', 'paused', 'picking'].includes(run.state);
  const stop =
    run.state === 'done' ? (
      <button className="btn btn-primary" onClick={act.stop}>
        Close
      </button>
    ) : (
      <button className="btn btn-ghost ml-auto px-1" onClick={act.stop}>
        <Stop />
        Stop
      </button>
    );
  return (
    <section className="flex flex-col gap-4" aria-label={`Playing ${run.name}`}>
      <div className="flex flex-col gap-2">
        <div>
          <p role="status" className="text-sm font-semibold">
            {HEADLINE[run.state]}
            {position}
            {rounds}
          </p>
          <p className="text-xs text-muted [overflow-wrap:anywhere]">{run.name}</p>
        </div>
        <div className="progress" aria-hidden>
          <span style={{ width: `${run.steps.length ? (done / run.steps.length) * 100 : 100}%` }} />
        </div>
      </div>
      <ol className="rows max-h-64 overflow-y-auto" aria-label="Steps">
        {run.steps.map((step, i) => (
          <li key={step.id} className="step" data-status={run.status[i]} aria-current={run.status[i] === 'running' ? 'step' : undefined}>
            <span aria-hidden className="step-icon">
              {ICON[run.status[i]!]}
            </span>
            <span className="sr-only">{STATUS[run.status[i]!]}:</span>
            <span className="track-label min-w-0 flex-1 [overflow-wrap:anywhere]">{step.label}</span>
            {(run.status[i] === 'running' || run.status[i] === 'failed') && (
              <span aria-hidden className="step-state">
                {STATUS[run.status[i]!]}
              </span>
            )}
          </li>
        ))}
      </ol>
      {run.message && (
        <p role="alert" className={run.state === 'failed' ? 'alert' : 'note'}>
          {run.state === 'failed' && <Alert />}
          <span>{rich(run.message)}</span>
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
            className="field flex-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn btn-primary h-8">Type it</button>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        {run.state === 'running' && (
          <button className="btn" onClick={act.pause}>
            <Pause />
            Pause
          </button>
        )}
        {run.state === 'paused' && (
          <button className="btn btn-primary" onClick={act.resume}>
            <Play />
            Continue
          </button>
        )}
        {run.state === 'waiting' && step?.action === 'upload' && (
          <button className="btn btn-primary" onClick={() => act.proceed()}>
            <Play />
            Continue
          </button>
        )}
        {(run.state === 'failed' || run.state === 'picking') && (
          <button className="btn btn-primary" onClick={act.resume}>
            <Retry />
            Try again
          </button>
        )}
        {run.state === 'failed' && step?.action !== 'navigate' && (
          <button className="btn" onClick={act.pick} title="Click the right item on the page; the macro remembers it">
            <Target />
            Pick it on the page
          </button>
        )}
        {!canSkip && stop}
      </div>
      {canSkip && (
        <div className="-mt-2 flex gap-2">
          <button className="btn btn-ghost px-1" onClick={act.skip}>
            <Skip />
            Skip this step
          </button>
          {stop}
        </div>
      )}
    </section>
  );
}
