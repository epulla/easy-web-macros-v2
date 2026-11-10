# Easy Web Macros — brand asset pack

## Primary concept
Purple robot mascot inspired by the selected first-row design. The robot holds a record/play/repeat controller. The small extension icon uses just the robot's face, since a full character becomes illegible at 16 px.

## Palette
- Deep indigo: `#15144F`
- Rich purple: `#6035E9`
- Violet: `#8D62FA`
- Soft lavender: `#E7DCFF`
- Recording coral: `#FF515E`
- Spark yellow: `#FFC51A`

## Fonts
Artwork uses the Inter family, with sans-serif fallbacks. PNGs already contain the typography, so no fonts are necessary when using them. SVG originals are included for further edits.

## Folders
- `chrome-extension/icons/`: actual extension icons at 16, 32, 48, 96, 128, 256, 512 px.
- `chrome-web-store/store-icon-128.png`: store icon with 16 px padding around the 96 px artwork.
- `chrome-web-store/promo-small-440x280.png`: small promotion graphic.
- `chrome-web-store/promo-marquee-1400x560.png`: main marquee promotion.
- `chrome-web-store/promo-marquee-art-only-1400x560.png`: alternate without text.
- `chrome-web-store/screenshot-templates/`: **PLACEHOLDERS, NOT screenshots**. These are not suitable for uploading as the store's mandatory screenshots. Capture the extension actually running in Chrome, then use a 1280x800 screenshot of its real UI, replacing the placeholder.
- `github/readme-banner-1600x500.png`: dark README header (recommended).
- `github/readme-banner-light-1600x480.png`: alternate light README banner.
- `github/social-preview-1280x640.png`: repo social preview graphic.
- `brand/png/`: transparent mascot, head, wordmark, and horizontal logo.
- `brand/source-svg/`: editable vector artwork and design sources.

## Installation in Chrome extension
Place icons in your repo's intended icons directory and ensure your WXT/manifest config references the correct files. Example Manifest V3 icon mapping:

```json
"icons": {
  "16": "icon/icon16.png",
  "32": "icon/icon32.png",
  "48": "icon/icon48.png",
  "128": "icon/icon128.png"
}
```

Only use these paths if your extension build actually puts the icons there; `public/icon/` often maps to `icon/` after bundling with WXT. Check your current `wxt.config.ts` and build output before copying the snippet.

## GitHub README
Copy `github/readme-banner-1600x500.png` to `assets/brand/readme-banner-1600x500.png` in the repository, then paste the contents of `github/README-banner-snippet.md` into README.md. Set `github/social-preview-1280x640.png` as the social preview image in repo settings.

## Publishing caveat
Chrome Web Store asks for at least one genuine 1280x800 screenshot showing the extension itself. Store metadata, permissions and wording must be checked against the actual extension before publishing. This pack does not claim to include actual runtime screenshots.

## Dimensions
Chrome Web Store 128x128 icon, 440x280 small promo, 1400x560 marquee, and up to 5 screenshots at 1280x800.

Official guidance: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
