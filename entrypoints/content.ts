import { record } from '../src/core/recorder';
import type { ToContent } from '../src/bg/recording';
import type { ToPage } from '../src/bg/replay';
import { captureTarget, type Target } from '../src/core/locator';
import { play } from '../src/core/player';
import type { ToBackground } from './background';

const INDICATOR_CSS = `
:host { all: initial; position: fixed; top: 12px; right: 12px; z-index: 2147483647; pointer-events: none; }
div { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
  background: rgb(17 17 17 / 0.85); color: #fff; font: 600 12px/1.4 system-ui, sans-serif; }
i { width: 8px; height: 8px; border-radius: 50%; background: #e11d48; animation: blink 1.2s infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) { i { animation: none; } }`;

// The next click picks an element instead of using it.
let endPick: (() => void) | undefined;
function pick(): Promise<Target> {
  endPick?.();
  return new Promise((resolve) => {
    const block = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const onClick = (e: Event) => {
      block(e);
      const el = e.composedPath()[0];
      if (!(el instanceof Element)) return;
      endPick?.();
      resolve(captureTarget(el));
    };
    const types = ['pointerdown', 'mousedown', 'pointerup', 'mouseup'];
    for (const t of types) document.addEventListener(t, block, true);
    document.addEventListener('click', onClick, true);
    document.documentElement.style.cursor = 'crosshair';
    endPick = () => {
      for (const t of types) document.removeEventListener(t, block, true);
      document.removeEventListener('click', onClick, true);
      document.documentElement.style.cursor = '';
      endPick = undefined;
    };
  });
}

// Clicks pass through it, so it never ends up in a recording.
function showIndicator(): () => void {
  const host = document.createElement('easy-web-macros-recording');
  host.attachShadow({ mode: 'closed' }).innerHTML = `<style>${INDICATOR_CSS}</style><div role="status"><i></i>Recording</div>`;
  document.documentElement.append(host);
  return () => host.remove();
}

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  allFrames: true,
  async main() {
    // Steps inside cross-origin frames can't be found again from the page, so skip them.
    if (window !== window.top && !window.frameElement) return;
    const top = window === window.top;
    const send = (msg: ToBackground) => browser.runtime.sendMessage(msg);
    let stop: (() => void) | undefined;
    const end = () => {
      stop?.();
      stop = undefined;
    };
    const begin = (hover: boolean) => {
      end();
      const stopRecording = record(document, (op) => void send({ type: 'op', op }).catch(() => {}), { hover });
      const hide = top ? showIndicator() : undefined;
      stop = () => {
        stopRecording();
        hide?.();
      };
    };
    browser.runtime.onMessage.addListener((msg: ToContent | ToPage) => {
      if (msg.type === 'play') return play(msg.step, msg.value);
      if (msg.type === 'where') return Promise.resolve(location.href);
      if (msg.type === 'pick') return pick();
      if (msg.type === 'pick-end') endPick?.();
      if (msg.type === 'start') {
        begin(msg.hover);
        if (top) void send({ type: 'started', url: location.href });
      }
      if (msg.type === 'stop') end();
    });
    const state = (await send({ type: 'hello', url: location.href, top })) as { hover: boolean } | null;
    if (state) begin(state.hover);
  },
});
