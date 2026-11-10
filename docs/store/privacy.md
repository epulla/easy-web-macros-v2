# Chrome Web Store privacy practices: 0.1.0

Answers for the dashboard **Privacy practices** tab. Checked against the built manifest (`pnpm build` → `.output/chrome-mv3/manifest.json`):

```json
"permissions": ["storage"],
"commands": { "toggle-recording": { "suggested_key": { "default": "Alt+Shift+R" } } },
"content_scripts": [{ "matches": ["http://*/*", "https://*/*"], "all_frames": true, "js": ["content-scripts/content.js"] }]
```

No `host_permissions`, no `optional_permissions`, no `tabs`, `scripting`, `activeTab` or `webRequest`. `chrome.tabs.query/create/update/sendMessage` and `chrome.action` badge calls need no permission. `commands` is not a permission.

## Single purpose

```
Easy Web Macros records the actions a user takes on a website (clicks, typing, choices) when they press Record, and replays them on request so repetitive web tasks take one click.
```

## Permission justifications

**storage**

```
Saves the user's recorded macros, playback speed and last playback result on their device with chrome.storage.local, and keeps an in-progress recording or playback in chrome.storage.session so it survives page loads. Nothing is synced or sent anywhere.
```

**Host permission** (content script on `http://*/*` and `https://*/*`, all frames)

```
Macros can be recorded and replayed on any website the user chooses, so the content script must run on http and https pages, including same-origin frames. While the user records, it turns their clicks, typing and choices into steps; while a macro plays, it finds each element and repeats the action. When neither is active it only asks the extension whether a recording is in progress and saves nothing.
```

## Remote code

**No, I am not using remote code.** All JavaScript is bundled in the package; no external scripts, `eval` or remote Wasm.

## Data usage

The User Data FAQ requires disclosing data handled even when it is only stored locally. Macros are stored only on the user's device and are never transmitted, so all of this is local handling.

| Data type | Tick | Why |
| --- | --- | --- |
| Personally identifiable information | ✅ | Text the user types while recording (for example a name or email in a form) is saved in the macro so it can be replayed. |
| Health information | ☐ | Not targeted; only if the user types it, covered by the row above. |
| Financial and payment information | ☐ | Not targeted. |
| Authentication information | ☐ | Password fields are never saved; replay asks the user to type the password each time. |
| Personal communications | ☐ | Not read. |
| Location | ☐ | Not used. |
| Web history | ✅ | Addresses of pages opened during a recording are saved as "Go to" steps. |
| User activity | ✅ | Clicks, typing, key presses, scrolling and (optional) hover during a recording are saved as steps. |
| Website content | ✅ | Names, labels and text of the clicked elements are saved so replay can find them again. |

Same four boxes as v1 0.0.6 declared, so no new data types are added for existing users.

## Certifications (tick all three)

- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases.
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

```
https://github.com/epulla/easy-web-macros-v2/blob/main/PRIVACY.md
```

Valid once `release/v0.1.0` is merged to `main` (the repo is public). Until then the `main` copy is the old text.

## Permission change for existing users

None. v1 0.0.6 (`epulla/easy-web-macros` `src/manifest.config.ts`) also had `permissions: ["storage"]` and a content script on `https://*/*` and `http://*/*`. v2 only adds `all_frames` and a keyboard command, which show no new warning, so existing users get no re-approval prompt.
