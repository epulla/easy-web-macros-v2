import React, { useState } from 'react';
import type { Run, StepStatus } from '../bg/replay';

const STATUS: Record<StepStatus, { icon: string; text: string; className: string }> = {
  pending: { icon: '○', text: 'Waiting', className: 'text-neutral-400' },
  running: { icon: '▶', text: 'Playing now', className: 'text-blue-600 animate-pulse motion-reduce:animate-none' },
  done: { icon: '✓', text: 'Done', className: 'text-emerald-600' },
  failed: { icon: '✕', text: 'Failed', className: 'text-rose-600' },
  skipped: { icon: '↷', text: 'Skipped', className: 'text-neutral-400' },
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
  return (
    <section className="flex flex-col gap-3" aria-label={`Playing ${run.name}`}>
      <p role="status" className="font-medium">
        {HEADLINE[run.state]}: {run.name}
        {rounds}
      </p>
      <ol className="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm">
        {run.steps.map((step, i) => {
          const s = STATUS[run.status[i]!];
          return (
            <li key={step.id} className="flex items-start gap-2" aria-current={run.status[i] === 'running' ? 'step' : undefined}>
              <span aria-hidden className={`w-4 shrink-0 text-center ${s.className}`}>
                {s.icon}
              </span>
              <span className="sr-only">{s.text}:</span>
              <span className={run.status[i] === 'failed' ? 'font-medium text-rose-700' : ''}>
                {i + 1}. {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {run.message && (
        <p role="alert" className={`text-sm ${run.state === 'failed' ? 'text-rose-700' : 'text-amber-800'}`}>
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
            className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn">Type it</button>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        {run.state === 'running' && (
          <button className="btn" onClick={act.pause}>
            Pause
          </button>
        )}
        {run.state === 'paused' && (
          <button className="btn" onClick={act.resume}>
            Continue
          </button>
        )}
        {run.state === 'waiting' && step?.action === 'upload' && (
          <button className="btn" onClick={() => act.proceed()}>
            Continue
          </button>
        )}
        {(run.state === 'failed' || run.state === 'picking') && (
          <button className="btn" onClick={act.resume}>
            Try again
          </button>
        )}
        {run.state === 'failed' && step?.action !== 'navigate' && (
          <button className="btn" onClick={act.pick} title="Click the right item on the page; the macro remembers it">
            Pick it on the page
          </button>
        )}
        {['failed', 'waiting', 'paused', 'picking'].includes(run.state) && (
          <button className="btn" onClick={act.skip}>
            Skip this step
          </button>
        )}
        <button className="btn" onClick={act.stop}>
          {run.state === 'done' ? 'Close' : 'Stop'}
        </button>
      </div>
    </section>
  );
}
