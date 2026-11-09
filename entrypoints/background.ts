import { addOp, hello } from '../src/bg/recording';
import type { RecordOp } from '../src/core/recorder';

export type ToBackground = { type: 'hello'; url: string; top: boolean } | { type: 'op'; op: RecordOp };

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: ToBackground, sender) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    if (msg.type === 'hello') return hello(tabId);
    if (msg.type === 'op') void addOp(tabId, msg.op);
  });
});
