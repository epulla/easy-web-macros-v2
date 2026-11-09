import { addOp, firstPage, hello, recording, startRecording, stopRecording } from '../src/bg/recording';
import { pageLoaded, pause, pickAgain, play, proceed, resume, resumeRun, run, skip, stopRun } from '../src/bg/replay';
import { welcomePage } from '../src/bg/welcome';
import { addMacro, deleteMacro, saveMacro } from '../src/bg/state';
import type { Macro } from '../src/core/macro';
import type { RecordOp } from '../src/core/recorder';

export type ToBackground =
  | { type: 'hello'; url: string; top: boolean }
  | { type: 'started'; url: string }
  | { type: 'op'; op: RecordOp }
  | { type: 'start'; tabId: number; hover: boolean }
  | { type: 'stop' }
  | { type: 'play'; macroId: string; tabId: number; from?: number; speed?: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop-run' }
  | { type: 'skip' }
  | { type: 'proceed'; value?: string }
  | { type: 'pick' }
  | { type: 'save-macro'; macro: Macro }
  | { type: 'add-macro'; macro: Macro }
  | { type: 'delete-macro'; id: string };

const showBadge = async () => {
  const [rec, r] = await Promise.all([recording.getValue(), run.getValue()]);
  const [text, color] = rec
    ? ['REC', '#e11d48']
    : r?.state === 'running'
      ? ['▶', '#2563eb']
      : r?.state === 'failed' || r?.state === 'waiting' || r?.state === 'picking'
        ? ['!', '#d97706']
        : ['', '#e11d48'];
  void browser.action.setBadgeText({ text });
  void browser.action.setBadgeBackgroundColor({ color });
};

export default defineBackground(() => {
  void showBadge();
  recording.watch(showBadge);
  run.watch(showBadge);
  void resumeRun();

  browser.runtime.onInstalled.addListener((details) => {
    const page = welcomePage(details);
    if (page) void browser.tabs.create({ url: browser.runtime.getURL(page) });
  });

  browser.runtime.onMessage.addListener((msg: ToBackground, sender) => {
    if (msg.type === 'start') return startRecording(msg.tabId, msg.hover);
    if (msg.type === 'stop') return stopRecording();
    if (msg.type === 'play') return play(msg.macroId, msg.tabId, msg);
    if (msg.type === 'pause') return pause();
    if (msg.type === 'resume') return resume();
    if (msg.type === 'stop-run') return stopRun();
    if (msg.type === 'skip') return skip();
    if (msg.type === 'proceed') return proceed(msg.value);
    if (msg.type === 'pick') return void pickAgain();
    if (msg.type === 'save-macro') return saveMacro(msg.macro);
    if (msg.type === 'add-macro') return addMacro(msg.macro);
    if (msg.type === 'delete-macro') return deleteMacro(msg.id);
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    if (msg.type === 'hello' && msg.top) pageLoaded(tabId, sender.tab?.openerTabId);
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
