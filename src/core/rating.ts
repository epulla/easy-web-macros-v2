// When to ask for a store rating: after 5 full replays that worked, never right after a
// failure, at most twice, and never again once the user rated or said no.
export interface Rating {
  successes: number;
  lastOk: boolean;
  asked: number;
  done: boolean;
}

export const NO_RATING: Rating = { successes: 0, lastOk: false, asked: 0, done: false };

export const recordRun = (r: Rating, ok: boolean): Rating => ({ ...r, successes: r.successes + (ok ? 1 : 0), lastOk: ok });

export const shouldAsk = (r: Rating) => !r.done && r.asked < 2 && r.lastOk && r.successes >= 5;

// "Not now" waits for 5 more successes before the second (and last) ask.
export const notNow = (r: Rating): Rating => ({ ...r, successes: 0, asked: r.asked + 1 });
