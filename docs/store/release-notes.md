# Easy Web Macros 0.1.0

Easy Web Macros 2 is a full rewrite. Record what you do on a website once, then play it back with one click.

## New

- **Your macros come with you.** Macros from the old version (0.0.x) move over automatically the first time the new version starts.
- **Records much more.** Clicks, double-clicks, typing, choices from lists, tick boxes, the Enter, Tab and Escape keys, file uploads, scrolling, pages you open and new tabs. Optionally records things you rest the pointer on, for menus that open on hover. Works inside frames and web components.
- **Finds the right thing.** Each step remembers several ways to find its button or field, so it still works when the page changes a little, and it waits for the page to be ready.
- **See every step play.** The popup shows each step as done, playing, failed or skipped. Pause or stop at any time.
- **Clear help when a step gets stuck.** A plain explanation of what went wrong, with Try again, Skip this step, or Pick it on the page (the macro keeps the fix).
- **Passwords are never saved.** When a macro reaches a password field, it asks you to type it. File uploads ask you to choose the file.
- **New editor.** Rename macros, set the wait between steps and how many times to play, reorder steps by dragging or with arrow buttons, and fix, duplicate or delete steps.
- **Speed and start point.** Play slow, normal, fast or fastest, or start from any step.
- **Share macros.** Save a macro to a file and add macros from a file.
- **Keyboard shortcut.** Alt+Shift+R (Option+Shift+R on Mac) starts or stops recording.
- **Welcome page** with a short how-to, and a "what's new" page when updating from the old version.
- A friendly, occasional request to rate the extension after it has worked for you a few times, with a link to report problems instead.

## Privacy

Macros stay in your browser, on your computer. Nothing is sent anywhere. Permissions are unchanged from the old version. See [PRIVACY.md](../../PRIVACY.md).

## Known limitations

- **Look-alike items that swap places.** If a page has several identical items with no label (for example, two unnamed icon buttons) and they change order, replay may use the wrong one. Fix: use Pick it on the page, or record on a label or text instead.
- **Rare password case.** If a password field has no label, sits inside a page widget (web component) that loads late, and you press its "show password" button before typing, the password may be saved as normal text. If that happens, delete or edit the step in the editor.
- **Editing the same field in two places.** If you change the same step or setting in two editor tabs or windows at once, the later change wins.
- **Page changes inside single-page apps.** When a site changes its address without loading a new page (single-page apps), no "Go to" step is recorded. Start the macro on the right page, or add the click that leads there.
- Tabs that were open before installing or updating need a reload before you can record in them.
- Chrome pages, the Chrome Web Store and other extensions' pages can't be recorded.
