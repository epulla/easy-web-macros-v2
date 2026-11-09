import { record } from '../src/core/recorder';
import type { ToContent } from '../src/bg/recording';
import type { ToBackground } from './background';

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  allFrames: true,
  async main() {
    // Steps inside cross-origin frames can't be found again from the page, so skip them.
    if (window !== window.top && !window.frameElement) return;
    const send = (msg: ToBackground) => browser.runtime.sendMessage(msg);
    let stop: (() => void) | undefined;
    const begin = (hover: boolean) => {
      stop?.();
      stop = record(document, (op) => void send({ type: 'op', op }).catch(() => {}), { hover });
    };
    browser.runtime.onMessage.addListener((msg: ToContent) => {
      if (msg.type === 'start') begin(msg.hover);
      if (msg.type === 'stop') {
        stop?.();
        stop = undefined;
      }
    });
    const state = (await send({ type: 'hello', url: location.href, top: window === window.top })) as { hover: boolean } | null;
    if (state) begin(state.hover);
  },
});
