import { describe, expect, it } from 'vitest';
import { NO_RATING, notNow, recordRun, shouldAsk, type Rating } from '../src/core/rating';

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
    const once = notNow(runs(NO_RATING, five));
    expect(shouldAsk(runs(once, five.slice(1)))).toBe(false);
    const twice = runs(once, five);
    expect(shouldAsk(twice)).toBe(true);
    expect(shouldAsk(runs(notNow(twice), five))).toBe(false);
  });

  it('never asks again once the user rated or said no', () => {
    expect(shouldAsk({ ...runs(NO_RATING, five), done: true })).toBe(false);
  });
});
