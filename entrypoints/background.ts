import { addOp, firstPage, hello, recording, startRecording, stopRecording, type Recording } from '../src/bg/recording';
import type { RecordOp } from '../src/core/recorder';

export type ToBackground =
  | { type: 'hello'; url: string; top: boolean }
  | { type: 'started'; url: string }
  | { type: 'op'; op: RecordOp }
  | { type: 'start'; tabId: number; hover: boolean }
  | { type: 'stop' };

const showBadge = (r: Recording | null) => {
  void browser.action.setBadgeText({ text: r ? 'REC' : '' });
  void browser.action.setBadgeBackgroundColor({ color: '#e11d48' });
};

export default defineBackground(() => {
  void recording.getValue().then(showBadge);
  recording.watch(showBadge);

  browser.runtime.onMessage.addListener((msg: ToBackground, sender) => {
    if (msg.type === 'start') return startRecording(msg.tabId, msg.hover);
    if (msg.type === 'stop') return stopRecording();
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    if (msg.type === 'hello') return hello(tabId, { ...msg, openerTabId: sender.tab?.openerTabId });
    if (msg.type === 'started') void firstPage(tabId, msg.url);
    if (msg.type === 'op') void addOp(tabId, msg.op);
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'toggle-recording') return;
    if (await recording.getValue()) await stopRecording();
    else if (tab?.id !== undefined) await startRecording(tab.id);
  });
});
