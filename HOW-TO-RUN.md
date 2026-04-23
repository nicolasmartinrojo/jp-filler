# JP Filler — Chrome Extension

A minimalist Chrome extension to find any HTML element by `id` on the current page.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [npm](https://www.npmjs.com/) (included with Node.js)
- Google Chrome (or any Chromium-based browser)

---

## 1. Install dependencies

```bash
cd jp-filler
npm install
```

---

## 2. Build the extension

Next.js exports the popup as static HTML/CSS/JS into the `out/` folder:

```bash
npm run build
```

After the build, the `out/` directory will contain everything Chrome needs.

---

## 3. Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `out/` folder inside this project

The extension icon will appear in the Chrome toolbar.

---

## 4. Use the extension

1. Navigate to any webpage
2. Click the extension icon to open the popup
3. Type an element `id` (without the `#`) in the input field
4. Press **Enter** or click **Search**
5. The result will show:
   - **Found** — the element's tag name, CSS classes, and a text preview
   - **Not found** — no element with that id exists on the page

---

## 5. Rebuild after changes

If you modify any source file, run the build again and then click the **reload icon** on the `chrome://extensions` page:

```bash
npm run build
```

---

## Project structure

```
jp-filler/
├── app/
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Popup UI & Chrome scripting logic
│   └── globals.css     # Minimal base styles
├── public/
│   └── manifest.json   # Chrome extension manifest (v3)
├── out/                # Build output — load this folder in Chrome
├── next.config.ts      # Next.js static export config
└── HOW-TO-RUN.md       # This file
```

---

## How it works

The popup uses `chrome.scripting.executeScript` (Manifest V3) to inject a small function into the active tab. That function calls `document.getElementById(id)` and returns the element's metadata back to the popup UI — no content script required.

Permissions used:
- `activeTab` — access the currently open tab
- `scripting` — inject the finder function into the page
