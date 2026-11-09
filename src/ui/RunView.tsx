import React from 'react';
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
  done: 'Finished',
};

export function RunView({ run, onPause, onResume, onStop }: { run: Run; onPause: () => void; onResume: () => void; onStop: () => void }) {
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
        <p role="alert" className="text-sm text-rose-700">
          {run.message}
        </p>
      )}
      <div className="flex gap-2">
        {run.state === 'running' && (
          <button className="btn" onClick={onPause}>
            Pause
          </button>
        )}
        {run.state === 'paused' && (
          <button className="btn" onClick={onResume}>
            Continue
          </button>
        )}
        <button className="btn" onClick={onStop}>
          {run.state === 'done' ? 'Close' : 'Stop'}
        </button>
      </div>
    </section>
  );
}
