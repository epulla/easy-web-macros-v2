# Privacy

Easy Web Macros records your actions on a website only while you are recording, so it can play them back later. Everything stays in your browser, on your computer.

## What is stored

- **Your macros:** for each step, a short description (for example `Click "Sign in"`), how to find the item on the page (its name, label, text or position), the address of pages you opened, the text you typed, the option you chose and the keys you pressed.
- **Passwords are never stored.** When a macro reaches a password field, it asks you to type it each time.
- **Files are never stored.** When a macro reaches a file upload, it asks you to choose the file each time.
- **Settings and history:** playback speed, whether each macro's last play worked, and whether you have been asked for a rating.
- **Macros from version 0.0.x:** copied into the new format on first start; the old copy stays in extension storage untouched.
- **While recording or playing:** the current recording or playback, kept only until the browser closes.

Everything is stored with Chrome's extension storage (`chrome.storage.local` and `chrome.storage.session`) on your device.

## What is shared

Nothing. The extension makes no network requests of its own: no servers, no accounts, no analytics, no ads, and no remote code. Your macros are never sold, shared or sent to the developer or anyone else.

Your data leaves your computer only if you choose to: **Save to a file** writes a macro to a file you pick, and the rating prompt opens the Chrome Web Store or GitHub Issues page in a new tab when you click it.

## Permissions

- `storage`: save your macros and settings on your device.
- Access to `http://` and `https://` pages (content script): record your clicks and typing while you record, and repeat them when you press Play. When you are not recording or playing, it only asks the extension whether a recording is in progress; nothing about the page is saved.

## Removing your data

Delete a macro in the editor, or uninstall the extension to remove all of its data.

## Contact

Questions or problems: https://github.com/epulla/easy-web-macros-v2/issues

Last updated: 2026-11-09
