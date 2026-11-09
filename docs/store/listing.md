# Chrome Web Store listing: 0.1.0

Existing item: `cmpjcbhhaneoeekleibpfoejfieblekk` (v1 listing "easy-web-macro-extension", 0.0.6). Upload 0.1.0 as an update to this item.

The store takes the **name** from the manifest `name` and the **summary** from the manifest `description` (both set in `wxt.config.ts`). The dashboard cannot override them.

## Name (≤75 characters)

```
Easy Web Macros: Record & Replay
```

## Short description / summary (≤132 characters)

```
Record what you do on a website once, then replay it with one click. Edit the steps and watch each one as it plays.
```

## Category

Productivity › Workflow & Planning

Language: English

## Full description

```
Easy Web Macros saves you from doing the same clicks and typing over and over. Record what you do on a website once, then play it back with one click.

HOW IT WORKS
1. Click the Easy Web Macros icon and press Record.
2. Use the website as usual. Every click and entry becomes a step.
3. Press Stop and save. Next time, press Play.

RECORDS WHAT YOU DO
• Clicks, double-clicks, typing, choices from lists, tick boxes and the Enter, Tab and Escape keys
• File uploads, scrolling, pages you open and new tabs
• Optional: things you rest the pointer on, for menus that open on hover
• Works inside frames and modern web components
• Start or stop recording with Alt+Shift+R (Option+Shift+R on Mac)

PLAYS IT BACK RELIABLY
• Finds the right button or field even when the page changes a little
• Waits for pages and buttons to be ready instead of rushing ahead
• Shows every step while it plays: done, playing now, failed or skipped
• When a step gets stuck, it tells you why in plain words. Try again, skip the step, or point at the right thing on the page and the macro keeps the fix
• Choose the speed (slow, normal, fast, fastest), start from any step, or repeat a macro several times
• Pause or stop at any time

EDIT YOUR MACROS
• Rename macros and change the wait between steps
• Reorder steps by dragging or with the arrow buttons
• Fix, duplicate or delete a step
• Save a macro to a file to share it or keep a copy, and add macros from a file

KEEPS YOUR PASSWORDS SAFE
Password fields are never saved. When a macro reaches one, it asks you to type it.

COMING FROM THE OLD VERSION?
Your saved macros move over automatically the first time the new version starts.

PRIVACY
Your macros are stored only in your browser, on your computer. Nothing is sent to us or anyone else. No accounts, no tracking, no ads.
Privacy policy: https://github.com/epulla/easy-web-macros-v2/blob/main/PRIVACY.md

Found a problem? Tell us at https://github.com/epulla/easy-web-macros-v2/issues
```

## What's new in 0.1.0

Use this where a "what's new" text fits (GitHub release, store description update, reply to reviews). Full notes: [release-notes.md](release-notes.md).

```
Easy Web Macros 2 is a full rewrite.
• Your macros from the old version move over automatically.
• Records much more: double-clicks, typing, lists, tick boxes, keys, file uploads, scrolling and new tabs.
• Finds the right button or field even when the page changes a little.
• Shows every step while it plays, and explains in plain words when something goes wrong, with Try again, Skip and Pick it on the page.
• Never saves passwords: it asks you each time instead.
• New editor: rename macros, reorder, fix, duplicate or delete steps.
• Choose the playback speed or start from any step.
• Save a macro to a file and add macros from a file.
• Keyboard shortcut Alt+Shift+R to start or stop recording.
```

## Screenshots

1280×800 PNGs in [screenshots/](screenshots/). The store accepts at most 5; upload in this order:

1. `1-popup-idle.png`
2. `2-popup-recording.png`
3. `3-popup-playing.png`
4. `4-popup-failed.png`
5. `5-editor.png`

`6-welcome.png` is a spare (replace one of the above if preferred).

Regenerate: `pnpm build`, then load `.output/chrome-mv3` as an unpacked extension in Chromium, seed sample macros and capture each page at 1280×800 (popup shots are framed on a 1280×800 background).

## Links

- Homepage URL: https://github.com/epulla/easy-web-macros-v2
- Support URL: https://github.com/epulla/easy-web-macros-v2/issues
- Privacy policy URL: https://github.com/epulla/easy-web-macros-v2/blob/main/PRIVACY.md (valid once `release/v0.1.0` is merged to `main`)
