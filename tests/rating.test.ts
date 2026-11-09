import { describe, expect, it } from 'vitest';
import { NO_RATING, markAsked, nextPrompt, recordRun, shouldAsk, type Prompt, type Rating } from '../src/core/rating';

const runs = (r: Rating, oks: boolean[]) => oks.reduce(recordRun, r);
const five = [true, true, true, true, true];

describe('shouldAsk', () => {
  it('asks after 5 successful replays, not before', () => {
    expect(shouldAsk(runs(NO_RATING, five.slice(1)))).toBe(false);
    expect(shouldAsk(runs(NO_RATING, five))).toBe(true);
  });

  it('never asks right after a failure, and asks again after the next success', () => {
    const failed = runs(NO_RATING, [...five, false]);
    expect(shouldAsk(failed)).toBe(false);
    expect(shouldAsk(recordRun(failed, true))).toBe(true);
  });

  it('asks at most twice, 5 successes apart', () => {
    const once = markAsked(runs(NO_RATING, five));
    expect(shouldAsk(runs(once, five.slice(1)))).toBe(false);
    const twice = runs(once, five);
    expect(shouldAsk(twice)).toBe(true);
    expect(shouldAsk(runs(markAsked(twice), five))).toBe(false);
  });

  it('never asks again once the user rated or said no', () => {
    expect(shouldAsk({ ...runs(NO_RATING, five), done: true })).toBe(false);
  });
});

describe('nextPrompt', () => {
  const ready = runs(NO_RATING, five);
  const shown = markAsked(ready);
  it.each<[string, Prompt, Rating, boolean, Prompt]>([
    ['waits while a run or recording is on screen', 'waiting', ready, false, 'waiting'],
    ['shows once the run view is closed after the fifth success', 'waiting', ready, true, 'showing'],
    ['stays up after counting the ask', 'showing', shown, true, 'showing'],
    ['closes when a replay fails meanwhile, even after Stop', 'showing', recordRun(shown, false), true, 'closed'],
    ['closes once the user rated or said no', 'showing', { ...shown, done: true }, true, 'closed'],
    ['stays closed for the rest of the visit', 'closed', ready, true, 'closed'],
  ])('%s', (_, p, r, idle, want) => expect(nextPrompt(p, r, idle)).toBe(want));
});
