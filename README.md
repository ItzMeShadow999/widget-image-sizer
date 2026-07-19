# W.I.S. — Widget Image Studio

A lightweight, blazing-fast browser utility designed to format, convert, and optimize assets for Discord and social platforms.

![System Tutorial](https://github.com/ItzMeShadow999/Widget-Image-Studio/blob/main/W.I.S.gif?raw=true)
---
![Website](https://img.shields.io/badge/Website-Live-000000?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgZmlsbD0id2hpdGUiIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJDNi40OSAyIDIgNi40OSAyIDEyczQuNDkgMTAgMTAgMTAgMTAtNC40OSAxMC0xMFMxNy41MSAyIDEyIDJNNCAxMmMwLS45LjE2LTEuNzYuNDMtMi41N0w2IDExbDIgMnYybDIgMiAxIDF2MS45M2MtMy45NC0uNDktNy0zLjg2LTctNy45M20xNC4zMyA0Ljg3Yy0uNjUtLjUzLTEuNjQtLjg3LTIuMzMtLjg3di0xYzAtMS4xLS45LTItMi0yaC00di0zYzEuMSAwIDItLjkgMi0yVjdoMWMxLjEgMCAyLS45IDItMnYtLjQxYzIuOTMgMS4xOSA1IDQuMDYgNSA3LjQxIDAgMS44My0uNjMgMy41Mi0xLjY3IDQuODciLz48L3N2Zz4K&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Mirror-Cloudflare-f38020?logo=cloudflare&logoColor=white)
![Status](https://img.shields.io/badge/Status-Online-brightgreen)
![Converter Formats](https://img.shields.io/badge/formats-PNG%20%7C%20JPG%20%7C%20WEBP%20%7C%20GIF%20%7C%20AVIF%20%7C%20BMP%20%7C%20TIFF%20%7C%20TGA%20%7C%20PPM%20%7C%20ICO%20%7C%20CUR%20%7C%20SVG%20%7C%20PDF-5865f2?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDVoN2w0IDR2MTFIOXoiIGZpbGw9IiM1ODY1ZjIiLz48cGF0aCBkPSJNNSA5aDdsNCA0djExSDV6IiBmaWxsPSIjNDc1MmM0Ii8+PC9zdmc+Cg==&logoColor=white)


## § How to Use

1. **Access the App:** Visit [𝚆.𝙸.𝚂 vercel](https://widgetimagestudio.vercel.app/) or [𝚆.𝙸.𝚂 cloudflare](https://widget-image-studio.shadow-164.workers.dev/) to use the tool instantly online, on whichever mirror is faster for you. Alternatively, clone the repository and spin up a local server to run it **FULLY OFFLINE** for total data privacy.
2. **Process Your Assets:** Navigate to the specific functional tab required for your project (Framer, Converter, or Advanced Editor).
3. **Pick a Theme:** Use the titlebar switcher to re-skin the whole app Original, White Mode, Kawaii, Discord, or Gothic. Your pick is remembered next time you visit.
4. **Configure & Tweak:** Drop your target files in (or paste a direct image/video URL), tweak the custom parameters, and watch the real-time layout updates process inside your browser canvas.
5. **Export:** Click the download trigger to compile and save your highly-optimized production assets locally.

---

## ◆ Compatibility & Built-On Source

This utility is engineered completely in vanilla ECMAScript modules with zero third-party framework dependencies, running entirely client-side for immediate execution loops.

Because it implements universal web standards and low-level canvas stream rendering, it can input absolutely **ANYTHING** you throw at it handling web standards, legacy image data structures, and rare asset formats interchangeably without requiring external backend processing.

> [!NOTE]
>This build serves its assets from the domain root (`/styles.css`, `/app.js`). If you're self-hosting from a subpath instead of the root, swap those two references back to relative paths (`./styles.css`, `./app.js`) before deploying.
>
>**Update (2.7.4):** `app.js` is now loaded as a classic script from a relative path (`./app.js`) by default see the patch note below. `styles.css` is still served from the domain root (`/styles.css`). If you're self-hosting from a subpath, you only need to swap the stylesheet reference back to a relative path now; the script reference is already relative.

**Need Help?** If you run into any setup failures or technical processing bugs, feel free to DM **[Shadow](https://discord.com/users/1065604516399026176)** directly on Discord.

---

## ▸ Key Features

* **Widget Framer (W.I.S.gif):** Trims headers using custom platform rules and sets anti-aliased border radius variables on raw imagery or full animated GIF sequences.
* **Theme Switcher:** Five full re-skins. Original, White Mode, Kawaii, Discord, and Gothic, applied live across every panel, including the Advanced Editor. Your choice persists across sessions.
* **White Mode Gatekeeper:** White Mode is locked behind a confirmation prompt and a flashbang transition. You have been warned.
* **Direct Media Downloader:** Paste an image or video URL and pull the file straight to disk, no extra steps. If the host blocks cross-origin fetches, you get a manual "open and save" fallback link instead of a silent failure.
* **Omnivorous Multi-Format Engine:** Seamlessly converts files across a massive formatting architecture including `PNG`, `JPG`, `WEBP`, `AVIF`, `GIF`, `BMP`, `TIFF`, `TGA`, `PPM`, `ICO`, `CUR`, `SVG`, and native standard `PDF` compilation.
* **Animated WebP Support:** Decodes and re-encodes animated `WEBP` frame-by-frame in the File Converter, on top of static formats.
* **Raster-to-Vector Layer Isolation:** Automatically packages physical binary raster blocks into base64 string attributes bound inside safe `SVG` viewport nodes.
* **W.I.S.AE Matrix Color Manipulation:** Computes real-time pixel modifications across channels like contrast, brightness, exposure, hue rotation ($0^\circ$ to $360^\circ$), noise variance, sharpening grids, and localized vignette masking.
* **Alpha Hardening Optimization Loop:** Pre-calculates transparency structures against an adjustable opacity baseline to safely prevent artifacts across historical rendering formats like static index-color GIFs.
* **ArrayBuffer Stream Compilation:** Implements synchronous file headers natively inside JavaScript arrays to manually generate custom binary layouts (e.g., `BMP` headers, `TGA` offsets, and structural dictionary nodes for `TIFF` files).
* **Canvas Grid Geometry Presets:** Ships with built-in layout frameworks built around strict target dimension parameters (Discord Widgets, Avatars, Server Icons; Instagram grids; YouTube Thumbnails; print standards).

---

## ▪ Dashboard Functions Documented

| Feature Trigger | System Action Behavior |
| :--- | :--- |
| **Widget Framer Execution** | Strips out layout components, processes canvas padding parameters, and handles client-side animation loops instantly. |
| **Theme Switching** | Swaps the `data-theme` root attribute, re-skins every panel live, and writes the choice to `localStorage` so it sticks on reload. |
| **Media URL Fetch** | Validates and pulls a direct image/video link cross-origin, then saves the resulting file straight to disk. |
| **Multi-Format Ingestion** | Accepts any generic binary stream file input and decodes structural components cleanly inside memory arrays. |
| **Vector Transcoding** | Encapsulates raster source arrays into dynamic vector packages without server-side compression loss. |
| **Matrix Tuning Engine** | Pushes custom mathematical filter transformations and rendering adjustments directly into hardware-accelerated loops. |
| **Alpha Hardening Calibration** | Evaluates alpha channel limits on source images to preserve visual data and clear background transparency. |
| **ArrayBuffer Generation** | Assembles native byte streams and writes customized formatting descriptors straight to downstream download blobs. |

---

## ▸ Installation

1. To work completely offline, clone the project files directly to your local workstation.
2. Ensure you have an active environment path setup to run a simple local static server wrapper:
   * **Python Local Infrastructure Setup:**
     ```bash
     python3 -m http.server 8080
     ```
   * **Node Local Infrastructure Setup:**
     ```bash
     npx serve .
     ```
3. Open your browser and navigate to the specified localhost address (e.g., `http://localhost:8080`) to interact with your tools locally with maximum data isolation.



<details>
  <summary>Patch Notes</summary>
  
# PATCH NOTES // 2.7.4

## [FIXED]
* **Widget Framer Cut-Off Output:** Previously, changing the `Top Strip` / `Radius` values on a source image whose dimensions didn't match the expected 512x512 widget size would cut off part of the image in the generated output instead of framing it properly. The framer now forces the output to the correct target size with no cropping/cut-off, regardless of the original image's dimensions.

## [CHANGED]
* **`app.js` Script Loading:** The `app.js` include is no longer declared as an ES module (`type="module"`) and no longer loads from the domain root. It now loads as a standard classic script from a relative path (`./app.js`), matching the rest of the local asset references.

## [NOTE]
* This changes script execution order: `app.js` now runs immediately as the parser reaches it, instead of being deferred until after the document finishes parsing. In practice this means `app.js` now executes *before* the inline colour-picker and warning-callout `<script>` blocks further down the page, rather than after them.
* Top-level declarations in `app.js` (e.g. `REFERENCE_SIZE`, `u16`, `u32`, `i32`, `modernGifPromise`, `webpEncoderPromise`, `tabButtons`) are no longer confined to module scope and now attach to the global `window` object.
* `styles.css` is unaffected and still loads from the domain root (`/styles.css`); see the updated note above.

---

# PATCH NOTES // 2.7.3

## [FIXED]

Widget Effect Top Strip Squish: applyWidgetEffect was cropping the top strip using the 5-argument form of drawImage, which only controls destination placement/size with no way to also crop the source, the entire image got squashed into the shorter remaining height. Switched to the 9-argument form to crop the source at the strip boundary and draw it 1:1 on the canvas, so the image below the strip renders full-size and undistorted, with the radius cutout clipping correctly against it.

---

# PATCH NOTES // 2.7.2

## [FIXED]

* **Opera GX Support:** Animated WEBP encoding and decoding now works fully in Opera GX. The built-in ad/tracker blocker was silently killing all cross-origin dynamic `import()` calls to CDN-hosted WASM modules the engine never loaded and output was broken or empty.

* **Inline WEBP Encoder Fallback:** When all CDN sources fail (Opera GX, strict CSP, network issues), the app now falls back to a pure-JS RIFF/WEBP muxer built directly into the bundle. No external download, nothing to block   animated WEBP output works regardless of network or browser policy.

* **Inline WEBP Decoder Fallback:** Opera GX either lacks or silently breaks the `ImageDecoder` API. Frame decoding now falls back to a pure-JS RIFF byte parser that extracts each `ANMF` chunk and renders it via a plain `<img>` element, no browser API required.

* **Corrupt ANMF Frame Layout:** The inline encoder was writing the X and Y offset fields of each `ANMF` chunk as 4-byte `uint32` values instead of the spec-required 3-byte `uint24`. This shifted every subsequent field (width, height, duration, flags) by one byte, producing scrambled or solid-colour output frames. Fixed to the correct 3-byte encoding.

* **Truncated Alpha Frames:** `frameToVP8Bytes` was stopping at the first matching chunk (`ALPH` or `VP8`), dropping the other. Frames with transparency require both chunks `ALPH` + `VP8` to be present. Fixed to collect and merge all frame chunks before writing to the ANMF payload.

---
  
 # PATCH NOTES // 2.7.1
 
## [FIXED]
Animated WEBP engine failing to load: now probes all known export shapes from the CDN module, adds two extra fallback sources, and gives a clearer error message if all sources fail.

---

  # PATCH NOTES // 2.7

## [ADDED]
* **Theme Switcher:** Titlebar dropdown for Original, White Mode, Kawaii, Discord, and Gothic, re-skins the entire app live, including the Advanced Editor. Choice is saved and restored on reload.
* **White Mode Gatekeeper:** Entering White Mode now requires confirming a warning modal, followed by a flashbang transition into the theme.
* **Direct Media Downloader:** New panel input to paste an image or video URL and download it straight to disk, with a manual fallback link if the host blocks the cross-origin fetch.
* **Animated WebP Support:** File Converter now decodes and re-encodes animated `WEBP` sources frame-by-frame instead of only grabbing the first frame.

## [CHANGED]
* **Cloudflare Mirror:** W.I.S. is now also live on Cloudflare Workers, alongside the existing Vercel deployment. Same app, pick whichever loads faster for you.
* **Asset Loading:** Stylesheet and script tags now load from the domain root (`/styles.css`, `/app.js`) instead of relative paths.

---

# PATCH NOTES // 2.6

## [FIXED]
* **UI & Rotation Wheel:** Restricted the rotation mechanics strictly to 360° to prevent the wheel component from breaking
* **Icon Alignment:** Corrected structural positioning for small icons across the interface
* **Advanced Editor:** Patched the tab line styling to correctly match the active theme
* **Free / DM Section:** Updated the file limit indicator text to accurately display "10mb"
* **Slider Controls:** Resolved a visual bug causing slider buttons to get cut off at the boundaries
* **Transformation Tools:** Fixed minor execution errors within Flip Z and Flip V functions

## [ADDED]
* **Warning Dialogs:** Integrated a dedicated close button for dismissing warning popups
* **Dynamic Background Picker:** Implemented a real-time background color picker equipped with a live preview window

---

# PATCH NOTES // 2.5

## [ADDED]
* **Custom Preset Save/Load:** Adjustment stacks (brightness, blur, filter, crop ratio) can now be saved as named custom presets and re-applied to any image in one click.
* **Business & Social Size Presets Expanded:** Added `Business Card`, `Postcard`, `Letter`, and `Sticker` print-ready presets alongside the existing social set (`IG Story`, `IG Landscape`, `Twitter Post`, `Twitter Header`, `Facebook Post`, `Pinterest`, `LinkedIn Banner`, `TikTok`, `YouTube Thumb`, `OG Image`).

## [FIXED]
* Crop ratio lock was silently resetting to `None` when switching between presets mid-edit.
* `adjBrightness` and `adjBlur` sliders desynced from their numeric input fields on rapid dragging.

---

# PATCH NOTES // 2.4

## [ADDED]
* **Filter Pack Mood Set:** Added `Cinematic`, `Noir`, `Vivid`, `Faded`, `Matte`, `Warm`, `Cool`, `Amber`, `Retro`, and `Summer` one-click filters.
* **Discord Asset Presets:** `Server Icon`, `Role Icon`, `Emoji`, `Profile Banner`, `Nitro`, and `Nitro Basic` size templates added for Discord-specific exports.

## [CHANGED]
* Filter preview thumbnails now render live on the source image instead of a generic placeholder swatch.

---

# PATCH NOTES // 2.3

## [ADDED]
* **App Icon / Game Icon / Store Art / Steam Hero presets:** Dedicated export sizes for devs shipping to storefronts.
* **"Go touch grass" idle Easter egg:** After 20 minutes of inactivity in the editor, a small toast nudges you to take a break. Purely cosmetic, dismissible, does not affect your work.

## [FIXED]
* Export queue would occasionally drop the last image in a multi-file batch if the tab lost focus mid-export.

---

# PATCH NOTES // 2.2

## [ADDED]
* **Open Graph / OG Image preset** for link-preview cards.
* **Itch Cover preset** for itch.io page banners.

## [FIXED]
* Custom colour picker was returning slightly shifted hex values compared to the on-screen swatch due to a colour-space rounding error.

---

# PATCH NOTES // 2.1

## [ADDED]
* **Keyboard shortcuts:** `Enter` to confirm active dialog, `Escape` to cancel/close wired up across preset pickers, warning modals, and the crop tool.

## [CHANGED]
* Editor now remembers the last-used export preset per session instead of defaulting back to `Widget` size every time.

## [FIXED]
* Avatar and Banner presets had swapped aspect ratios in the preset dropdown (Avatar was exporting as a banner ratio and vice versa).

---

# PATCH NOTES // 2.0

## [ADDED]
* **Full Editor Rewrite:** Rebuilt the image pipeline around a single adjustment stack instead of stacking DOM filters, laying the groundwork for the theme system and filter packs added in later versions.
* **Batch Export:** Apply one preset/filter combo across multiple uploaded images at once.

## [CHANGED]
* Rebranded from internal codename "WIF" to **W.I.S. — Widget Image Studio**.

---

# PATCH NOTES // 1.4

## [ADDED]
* **Business Card & Widget presets** the first non-social export sizes.
* Basic brightness and blur sliders (`adjBrightness`, `adjBlur`) added to the editor panel.

## [FIXED]
* Uploading a non-image file silently froze the editor instead of showing the `Not an image` error message.

---

# PATCH NOTES // 1.3

## [ADDED]
* **Instagram & Twitter presets:** `IG Story`, `IG Landscape`, `Twitter Post`, `Twitter Header`.

## [FIXED]
* Drag-and-drop upload wasn't registering on Firefox due to a missing `dragover` preventDefault call.

---

# PATCH NOTES // 1.2

## [ADDED]
* **Crop tool v1:** Freeform and locked-ratio cropping.

## [CHANGED]
* Upload zone redesigned to accept paste-from-clipboard in addition to drag-and-drop and file picker.

---

# PATCH NOTES // 1.1

## [FIXED]
* First stability patch post-launch: fixed a memory leak where re-uploading an image without refreshing the page would keep the previous image's canvas alive in memory.
* Export button was exporting at the canvas's on-screen pixel size instead of the original image resolution.

---

# PATCH NOTES // 1.0 — Initial Release

## [ADDED]
* Core image upload → preview → export pipeline.
* Single default `Avatar` export preset.
* Basic PNG/JPEG export.

---

# PATCH NOTES // 0.6 Beta

## [FIXED]
* Canvas rendering would occasionally show a blank frame on first load in Safari due to a race between the image `onload` event and canvas context initialization.

## [ADDED]
* Minimal loading spinner during export.

---

# PATCH NOTES // 0.5 Beta

## [ADDED]
* First working export-to-file button (previously export only opened the result in a new tab).

## [CHANGED]
* Moved from a single-page inline script to a proper `app.js` file, separating logic from markup for the first time.

---

# PATCH NOTES // 0.4 Beta

## [FIXED]
* Uploaded images larger than 4000px on either dimension would crash the canvas renderer on lower-end devices.

## [ADDED]
* Basic file size/type validation before attempting to render an upload.

---

# PATCH NOTES // 0.3 Beta

## [ADDED]
* Second image preset added (previously only one fixed square output size existed) this became the seed for the full preset system in later versions.

## [CHANGED]
* Replaced placeholder Comic Sans UI font with a proper system font stack.

---

# PATCH NOTES // 0.2 Beta

## [FIXED]
* Fixed the editor not clearing the canvas between image uploads, causing ghosting of the previous image behind the new one.

## [ADDED]
* Basic dark background for the editor view (still no theme system just a single hardcoded dark palette).

---

# PATCH NOTES // 0.1 Beta — First Build

## [ADDED]
* Proof-of-concept build: upload a single image, view it on an HTML canvas, download it back out unmodified.
* No presets, no filters, no editing tools just upload → view → export.

---

*Notes 0.1–2.5 compiled retroactively for archive purposes. For the actively maintained changelog, see PATCH NOTES // 2.6 onward.*

</details>

<details>
  <summary>Coming Soon!</summary>

  # COMING SOON

## [TOOLS]
* **Full Video Conversion:** Output straight to `MP4`, `WEBM`, or an animated `GIF` from a video source, right from the File Converter's format list.

## [POLISH]
* Smoother popovers, tighter theme consistency across chips, sliders, and the rotation ring, especially on Kawaii and Discord.

## [COMMUNITY]
Want an early look at what's cooking, or got an idea for a feature?

* [Join Discord Previews](https://discord.gg/discord-603970300668805120)
* [And give your suggestions!](https://discord.com/channels/603970300668805120/1520805824040013976/threads/1524439129759285438/1524439129759285438)

Or directly DM [Shadow](https://discord.com/users/1065604516399026176)
</details>


---

## 📄 License & Attribution

This project is open-source software licensed under the **MIT License**.

```text
MIT License

Copyright (c) 2026 Shadow (ItzMeShadow999)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
