const REFERENCE_SIZE = 512;
const AUTO_TOP_STRIP_BASE = 17;
const AUTO_RADIUS_BASE = 36;
const AUTO_TOP_STRIP_EXPONENT =
  Math.log(54 / 17) / Math.log(Math.sqrt(1844 * 853) / REFERENCE_SIZE);
const AUTO_RADIUS_EXPONENT =
  Math.log(172 / 36) / Math.log(Math.sqrt(1844 * 853) / REFERENCE_SIZE);

const MAX_ICON_SIZE = 256;



function u16(view, offset, value) { view.setUint16(offset, value, true); }
function u32(view, offset, value) { view.setUint32(offset, value, true); }
function i32(view, offset, value) { view.setInt32(offset, value, true); }

function flattenOnWhite({ width, height, data }) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const a = data[o + 3] / 255;
    out[o] = Math.round(data[o] * a + 255 * (1 - a));
    out[o + 1] = Math.round(data[o + 1] * a + 255 * (1 - a));
    out[o + 2] = Math.round(data[o + 2] * a + 255 * (1 - a));
    out[o + 3] = 255;
  }
  return out;
}

function encodeBMP({ width, height, data }) {
  const rgb = flattenOnWhite({ width, height, data });
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 14 + 40 + pixelArraySize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  bytes[0] = 0x42; bytes[1] = 0x4d;
  u32(view, 2, fileSize);
  u32(view, 6, 0);
  u32(view, 10, 14 + 40);

  u32(view, 14, 40);
  i32(view, 18, width);
  i32(view, 22, height);
  u16(view, 26, 1);
  u16(view, 28, 24);
  u32(view, 30, 0);
  u32(view, 34, pixelArraySize);
  i32(view, 38, 2835);
  i32(view, 42, 2835);
  u32(view, 46, 0);
  u32(view, 50, 0);

  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    let rowOffset = offset;
    for (let x = 0; x < width; x++) {
      const srcO = (y * width + x) * 4;
      bytes[rowOffset++] = rgb[srcO + 2];
      bytes[rowOffset++] = rgb[srcO + 1];
      bytes[rowOffset++] = rgb[srcO];
    }
    offset += rowSize;
  }
  return bytes;
}

function encodeTGA({ width, height, data }) {
  const bytes = new Uint8Array(18 + width * height * 4);
  const view = new DataView(bytes.buffer);

  bytes[2] = 2;
  u16(view, 12, width);
  u16(view, 14, height);
  bytes[16] = 32;
  bytes[17] = 0x28;

  let o = 18;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      bytes[o++] = data[s + 2];
      bytes[o++] = data[s + 1];
      bytes[o++] = data[s];
      bytes[o++] = data[s + 3];
    }
  }
  return bytes;
}

function encodePPM({ width, height, data }) {
  const rgb = flattenOnWhite({ width, height, data });
  const header = `P6\n${width} ${height}\n255\n`;
  const headerBytes = new TextEncoder().encode(header);
  const bytes = new Uint8Array(headerBytes.length + width * height * 3);
  bytes.set(headerBytes, 0);
  let o = headerBytes.length;
  for (let i = 0; i < width * height; i++) {
    const s = i * 4;
    bytes[o++] = rgb[s];
    bytes[o++] = rgb[s + 1];
    bytes[o++] = rgb[s + 2];
  }
  return bytes;
}

function encodeTIFF({ width, height, data }) {
  const entries = [];
  const extraChunks = [];

  function addEntry(tag, type, count, inlineOrBytes) {
    if (inlineOrBytes instanceof Uint8Array) {
      extraChunks.push(inlineOrBytes);
      entries.push({ tag, type, count, external: true, chunkIndex: extraChunks.length - 1 });
    } else {
      entries.push({ tag, type, count, external: false, value: inlineOrBytes });
    }
  }

  const TYPE_SHORT = 3, TYPE_LONG = 4, TYPE_RATIONAL = 5;

  addEntry(256, TYPE_LONG, 1, width);
  addEntry(257, TYPE_LONG, 1, height);
  {
    const b = new Uint8Array(8);
    const v = new DataView(b.buffer);
    v.setUint16(0, 8, true); v.setUint16(2, 8, true); v.setUint16(4, 8, true); v.setUint16(6, 8, true);
    addEntry(258, TYPE_SHORT, 4, b);
  }
  addEntry(259, TYPE_SHORT, 1, 1);
  addEntry(262, TYPE_SHORT, 1, 2);
  addEntry(273, TYPE_LONG, 1, 0);
  addEntry(277, TYPE_SHORT, 1, 4);
  addEntry(278, TYPE_LONG, 1, height);
  addEntry(279, TYPE_LONG, 1, width * height * 4);
  {
    const b = new Uint8Array(8);
    const v = new DataView(b.buffer);
    v.setUint32(0, 72, true); v.setUint32(4, 1, true);
    addEntry(282, TYPE_RATIONAL, 1, b);
  }
  {
    const b = new Uint8Array(8);
    const v = new DataView(b.buffer);
    v.setUint32(0, 72, true); v.setUint32(4, 1, true);
    addEntry(283, TYPE_RATIONAL, 1, b);
  }
  addEntry(284, TYPE_SHORT, 1, 1);
  addEntry(296, TYPE_SHORT, 1, 2);
  addEntry(338, TYPE_SHORT, 1, 2);

  entries.sort((a, b) => a.tag - b.tag);

  const ifdSize = 2 + entries.length * 12 + 4;
  const ifdStart = 8;
  const extraStart = ifdStart + ifdSize;
  const chunkOffsets = [];
  let cursor = extraStart;
  for (const chunk of extraChunks) {
    chunkOffsets.push(cursor);
    cursor += chunk.length;
    if (cursor % 2 !== 0) cursor += 1;
  }
  const imageDataOffset = cursor % 2 !== 0 ? cursor + 1 : cursor;

  for (const e of entries) {
    if (e.tag === 273) e.value = imageDataOffset;
  }

  const totalSize = imageDataOffset + width * height * 4;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  bytes[0] = 0x49; bytes[1] = 0x49;
  u16(view, 2, 42);
  u32(view, 4, ifdStart);

  u16(view, ifdStart, entries.length);
  let entryOffset = ifdStart + 2;
  for (const e of entries) {
    u16(view, entryOffset, e.tag);
    u16(view, entryOffset + 2, e.type);
    u32(view, entryOffset + 4, e.count);
    if (e.external) {
      u32(view, entryOffset + 8, chunkOffsets[e.chunkIndex]);
    } else if (e.type === TYPE_SHORT) {
      u16(view, entryOffset + 8, e.value);
      u16(view, entryOffset + 10, 0);
    } else {
      u32(view, entryOffset + 8, e.value);
    }
    entryOffset += 12;
  }
  u32(view, entryOffset, 0);

  for (let i = 0; i < extraChunks.length; i++) {
    bytes.set(extraChunks[i], chunkOffsets[i]);
  }
  bytes.set(data, imageDataOffset);

  return bytes;
}




function encodeIcoContainer({ width, height, data }, isCursor) {
  const andRowBytes = Math.ceil(width / 8 / 4) * 4;
  const andMaskSize = andRowBytes * height;
  const xorSize = width * height * 4;
  const dibHeaderSize = 40;
  const imageSize = dibHeaderSize + xorSize + andMaskSize;

  const bytes = new Uint8Array(6 + 16 + imageSize);
  const view = new DataView(bytes.buffer);

  u16(view, 2, isCursor ? 2 : 1);
  u16(view, 4, 1);

  const dimByte = (v) => (v >= 256 ? 0 : v);
  bytes[6] = dimByte(width);
  bytes[7] = dimByte(height);

  if (isCursor) {
    u16(view, 10, Math.round(width / 2));
    u16(view, 12, Math.round(height / 2));
  } else {
    u16(view, 10, 1);
    u16(view, 12, 32);
  }

  u32(view, 14, imageSize);
  u32(view, 18, 22);

  const imgStart = 22;
  u32(view, imgStart, dibHeaderSize);
  i32(view, imgStart + 4, width);
  i32(view, imgStart + 8, height * 2);
  u16(view, imgStart + 12, 1);
  u16(view, imgStart + 14, 32);
  u32(view, imgStart + 16, 0);
  u32(view, imgStart + 20, xorSize);

  let o = imgStart + dibHeaderSize;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      bytes[o++] = data[s + 2];
      bytes[o++] = data[s + 1];
      bytes[o++] = data[s];
      bytes[o++] = data[s + 3];
    }
  }
  
  return bytes;
}

function encodePDF(jpegBytes, width, height) {
  const ptsPerPixel = 0.75; 
  const pw = Math.max(1, Math.round(width * ptsPerPixel));
  const ph = Math.max(1, Math.round(height * ptsPerPixel));

  const enc = new TextEncoder();
  const chunks = [];
  let cursor = 0;
  const offsets = [0];

  function push(bytesOrStr) {
    const b = typeof bytesOrStr === "string" ? enc.encode(bytesOrStr) : bytesOrStr;
    chunks.push(b);
    cursor += b.length;
  }

  push("%PDF-1.4\n");

  offsets[1] = cursor;
  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  offsets[2] = cursor;
  push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);

  offsets[3] = cursor;
  push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);

  offsets[4] = cursor;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  push(jpegBytes);
  push(`\nendstream\nendobj\n`);

  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  offsets[5] = cursor;
  push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefStart = cursor;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) {
    push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}



function clearObjectUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

function yieldToUI() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode this file as an image."));
    image.src = src;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error(`This browser can't encode ${mimeType}.`))),
      mimeType,
      quality
    );
  });
}

function drawToCanvas(source, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function flattenCanvasOnWhite(canvas) {
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return flat;
}

function scaleCanvasToMax(canvas, maxSize) {
  const { width, height } = canvas;
  if (width <= maxSize && height <= maxSize) return canvas;
  const scale = maxSize / Math.max(width, height);
  return drawToCanvas(canvas, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
}

function getImageData(canvas) {
  return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
}

function guessExtensionFromContentType(contentType) {
  const subtype = contentType.split("/")[1]?.split(/[+;]/)[0]?.toLowerCase();
  if (!subtype) return "png";
  if (subtype === "jpg" || subtype === "jpeg") return "jpg";
  if (["png", "gif", "webp", "bmp", "avif"].includes(subtype)) return subtype;
  return "png";
}

function fileNameFromUrl(url, contentType) {
  let pathname = "image";
  try {
    pathname = new URL(url).pathname.split("/").pop() || "image";
  } catch {
    
  }
  pathname = decodeURIComponent(pathname).split(/[?#]/)[0] || "image";

  if (/\.(png|jpe?g|webp|gif|bmp|ico|svg|avif|tiff?|tga|ppm)$/i.test(pathname)) {
    return pathname;
  }

  const extension = guessExtensionFromContentType(contentType || "");
  const stem = pathname.replace(/\.[^.]+$/, "") || "image";
  return `${stem}.${extension}`;
}

async function fetchImageAsFile(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) image URLs are supported.");
  }

  let response;
  try {
    response = await fetch(url.href, { mode: "cors", referrerPolicy: "no-referrer" });
  } catch {
    throw new Error("Could not fetch that URL. The site may block cross-origin requests.");
  }
  if (!response.ok) {
    throw new Error(`The server responded with ${response.status} while fetching that URL.`);
  }

  const blob = await response.blob();
  const contentType = blob.type || response.headers.get("content-type") || "";
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error("That URL doesn't point to an image.");
  }

  const fileName = fileNameFromUrl(url.href, contentType);
  return new File([blob], fileName, { type: contentType || "image/png" });
}

function mediaFileNameFromUrl(url, contentType) {
  let pathname = "download";
  try {
    pathname = new URL(url).pathname.split("/").pop() || "download";
  } catch {
    
  }
  pathname = decodeURIComponent(pathname).split(/[?#]/)[0] || "download";

  if (/\.(mp4|gif|webm|mov|m4v|png|jpe?g|webp|bmp|ico|svg|avif|tiff?|tga|ppm|heic|heif)$/i.test(pathname)) {
    return pathname;
  }

  const subtype = (contentType || "").split("/")[1]?.split(/[+;]/)[0]?.toLowerCase();
  const EXT_MAP = { quicktime: "mov", jpeg: "jpg", "svg+xml": "svg" };
  const extension = EXT_MAP[subtype] || subtype || "mp4";
  const stem = pathname.replace(/\.[^.]+$/, "") || "download";
  return `${stem}.${extension}`;
}

async function fetchMediaAsFile(rawUrl, { acceptTypes } = {}) {
  // Accept any image or video by default — the "direct download" box
  // isn't limited to mp4/gif anymore, just anything the browser can
  // fetch directly (subject to the host allowing cross-origin reads).
  const types = acceptTypes ?? ["video/", "image/"];

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.");
  }

  let response;
  try {
    response = await fetch(url.href, { mode: "cors", referrerPolicy: "no-referrer" });
  } catch {
    const error = new Error("Could not fetch that URL — the host may block cross-origin requests.");
    error.corsLikely = true;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}.`);
  }

  const blob = await response.blob();
  const contentType = blob.type || response.headers.get("content-type") || "";
  if (types.length && !types.some((t) => contentType.startsWith(t))) {
    throw new Error("That URL doesn't point to an image or video file.");
  }

  const fileName = mediaFileNameFromUrl(url.href, contentType);
  return new File([blob], fileName, { type: contentType });
}

function saveFileToDisk(file) {
  const objectUrl = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function wireMediaDownloader({ urlInput, downloadButton, statusEl, spinnerEl, fallbackWrap, fallbackTextEl }) {
  function setStatus(message, tone = "neutral") {
    statusEl.textContent = message;
    statusEl.dataset.tone = tone;
  }

  function setBusy(busy) {
    downloadButton.disabled = busy;
    spinnerEl.hidden = !busy;
  }

  function showFallback(url) {
    fallbackWrap.hidden = false;
    const body = fallbackWrap.querySelector("#mediaDownloadFallbackBody") ?? fallbackWrap;
    body.querySelectorAll("a").forEach((el) => el.remove());
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open file directly (right-click → Save As)";
    link.className = "gif-note-link";
    body.appendChild(link);
  }

  function hideFallback() {
    fallbackWrap.hidden = true;
  }

  async function runDownload() {
    const trimmed = (urlInput.value || "").trim();
    if (!trimmed) {
      setStatus("Paste a direct image or video link first.", "error");
      return;
    }

    hideFallback();
    setBusy(true);
    setStatus("Fetching file…", "neutral");

    try {
      const file = await fetchMediaAsFile(trimmed);
      saveFileToDisk(file);
      setStatus(`Downloaded ${file.name}.`, "success");
      urlInput.value = "";
    } catch (error) {
      setStatus(String(error?.message ?? error), "error");
      if (error?.corsLikely) {
        showFallback(trimmed);
      }
    } finally {
      setBusy(false);
    }
  }

  downloadButton.addEventListener("click", runDownload);
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runDownload();
    }
  });
}

function getSuggestedOutputName(fileName, extension) {
  const cleanName = fileName.split(/[/\\]/).pop() ?? "image";
  const stem = cleanName.replace(/\.[^.]+$/, "") || "image";
  return `${stem}-resized.${extension}`;
}

function replaceExtension(fileName, extension) {
  const stem = fileName.replace(/\.[^.]+$/, "") || fileName || "output";
  return `${stem}.${extension}`;
}

function isGifInput(fileName) {
  return /\.gif$/i.test(fileName);
}



let modernGifPromise = null;

async function loadModernGif() {
  if (modernGifPromise) return modernGifPromise;

  modernGifPromise = (async () => {
    const sources = [
      "https://esm.sh/modern-gif@2.1.0",
      "https://cdn.jsdelivr.net/npm/modern-gif@2.1.0/+esm"
    ];

    let lastError = null;
    for (const source of sources) {
      try {
        const module = await import( source);
        if (module?.decode && module?.decodeFrames && module?.encode) {
          return module;
        }
        lastError = new Error(`Loaded ${source} but it did not expose the expected GIF API.`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("Could not load the GIF engine from any source.");
  })();

  try {
    return await modernGifPromise;
  } catch (error) {
    modernGifPromise = null;
    throw error;
  }
}



function createPanelUI(refs) {
  function setPreviewLoading(loading, message = "Loading preview...") {
    refs.previewLoading.hidden = !loading;
    refs.previewLoadingText.textContent = loading ? message : "";
  }

  function setProgressState(visible, percent = 0, label = "") {
    const clamped = Math.max(0, Math.min(100, percent));
    refs.progressWrap.hidden = !visible;
    refs.progressBar.style.width = `${clamped}%`;
    refs.progressBar.setAttribute("aria-valuenow", String(clamped));
    refs.progressLabel.textContent = label || `${clamped}%`;
  }

  function setPreviewMeta(message = "") {
    refs.previewMeta.textContent = message;
  }

  function setPreview(src, label) {
    refs.previewImage.src = src;
    refs.previewImage.alt = label;
    refs.previewImage.hidden = false;
    refs.previewEmpty.hidden = true;
  }

  function clearPreview() {
    refs.previewImage.removeAttribute("src");
    refs.previewImage.hidden = true;
    refs.previewEmpty.hidden = false;
    ui.baseMeta = "";
    setPreviewMeta("");
    setPreviewLoading(false);
    setProgressState(false, 0, "");
    ui.updateTitlebar();
  }

  function updatePreviewMetaWithDimensions() {
    if (refs.previewImage.hidden || !refs.previewImage.naturalWidth || !refs.previewImage.naturalHeight) {
      setPreviewMeta(ui.baseMeta);
      return;
    }
    const dims = `${refs.previewImage.naturalWidth}x${refs.previewImage.naturalHeight}`;
    setPreviewMeta(ui.baseMeta ? `${ui.baseMeta} ${dims}.` : dims);
  }

  function setStatus(message, tone = "neutral") {
    refs.status.textContent = message;
    refs.status.dataset.tone = tone;
    ui.updateTitlebar();
  }

  const ui = {
    baseMeta: "",
    setPreviewLoading,
    setProgressState,
    setPreviewMeta,
    setPreview,
    clearPreview,
    updatePreviewMetaWithDimensions,
    setStatus,
    updateTitlebar: () => {},
  };

  refs.previewImage.addEventListener("load", () => {
    setPreviewLoading(false);
    updatePreviewMetaWithDimensions();
  });
  refs.previewImage.addEventListener("error", () => {
    setPreviewLoading(false);
    setPreviewMeta(ui.baseMeta || "Preview unavailable.");
  });

  return ui;
}



function wireImagePicker({ dropZone, browseButton, fileInput, urlInput, urlImportButton, ui, onFile }) {
  function openFileDialog() {
    return new Promise((resolve) => {
      fileInput.value = "";
      fileInput.onchange = () => resolve(fileInput.files?.[0] ?? null);
      fileInput.click();
    });
  }

  async function importFromUrl(rawUrl) {
    const trimmed = (rawUrl || "").trim();
    if (!trimmed) {
      ui.setStatus("Paste an image URL first.", "error");
      return;
    }
    urlImportButton.disabled = true;
    ui.setStatus("", "neutral");
    ui.setPreviewLoading(true, "Fetching image from URL...");
    try {
      const file = await fetchImageAsFile(trimmed);
      await onFile(file);
      urlInput.value = "";
    } catch (error) {
      ui.setPreviewLoading(false);
      ui.setStatus(String(error?.message ?? error), "error");
    } finally {
      urlImportButton.disabled = false;
    }
  }

  browseButton.addEventListener("click", async () => {
    const selected = await openFileDialog();
    if (selected) await onFile(selected);
  });

  urlImportButton.addEventListener("click", async () => {
    await importFromUrl(urlInput.value);
  });

  urlInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await importFromUrl(urlInput.value);
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("drag-over");
    });
  });

  dropZone.addEventListener("drop", async (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await onFile(file);
      return;
    }
    const draggedUrl =
      event.dataTransfer?.getData("text/uri-list") ||
      event.dataTransfer?.getData("text/plain") ||
      "";
    const firstUrl = draggedUrl
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    if (firstUrl) await importFromUrl(firstUrl);
  });
}



const tabButtons = document.querySelectorAll(".tab-button");
const panels = {
  framer: document.querySelector("#framerPanel"),
  converter: document.querySelector("#converterPanel"),
  advanced: document.querySelector("#advancedEditorPanel"),
};

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.tab;
    tabButtons.forEach((b) => b.setAttribute("aria-selected", String(b === button)));
    Object.entries(panels).forEach(([key, panel]) => {
      panel.hidden = key !== target;
    });
  });
});



document.querySelectorAll(".warn-callout-close").forEach((btn) => {
  btn.addEventListener("click", () => {
    const callout = btn.closest(".warn-callout");
    if (!callout || callout.classList.contains("is-dismissing")) return;

    
    callout.style.maxHeight = callout.getBoundingClientRect().height + "px";
    callout.setAttribute("aria-hidden", "true");
    callout.classList.add("is-dismissing");

    callout.addEventListener("animationend", () => {
      
      callout.classList.add("is-collapsing");
      callout.style.maxHeight = "0px";
      callout.style.paddingTop = "0px";
      callout.style.paddingBottom = "0px";
      callout.style.borderWidth = "0px";

      callout.addEventListener("transitionend", (event) => {
        if (event.target === callout) callout.remove();
      }, { once: true });
    }, { once: true });
  });
});



(function widgetFramer() {
  const titlebarStatus = document.querySelector("#titlebarStatus");

  const refs = {
    dropZone: document.querySelector("#dropZone"),
    previewEmpty: document.querySelector("#previewEmpty"),
    previewLoading: document.querySelector("#previewLoading"),
    previewLoadingText: document.querySelector("#previewLoadingText"),
    progressWrap: document.querySelector("#progressWrap"),
    progressBar: document.querySelector("#progressBar"),
    progressLabel: document.querySelector("#progressLabel"),
    previewImage: document.querySelector("#previewImage"),
    previewMeta: document.querySelector("#previewMeta"),
    status: document.querySelector("#status"),
  };

  const inputPath = document.querySelector("#inputPath");
  const outputName = document.querySelector("#outputName");
  const outputFormat = document.querySelector("#outputFormat");
  const topStrip = document.querySelector("#topStrip");
  const radius = document.querySelector("#radius");
  const highQualityAnimated = document.querySelector("#highQualityAnimated");
  const browseButton = document.querySelector("#browseButton");
  const advancedToggleBtn = document.querySelector("#advancedToggleBtn");
  const advancedPanel = document.querySelector("#advancedPanel");
  const processButton = document.querySelector("#processButton");
  const downloadButton = document.querySelector("#downloadButton");
  const localFileInput = document.querySelector("#localFileInput");
  const urlInput = document.querySelector("#urlInput");
  const urlImportButton = document.querySelector("#urlImportButton");

  const ui = createPanelUI(refs);

  let lastResult = null;
  let selectedFile = null;
  let selectedInputUrl = "";
  let outputUrl = "";

  function updateTitlebarStatus() {
    if (refs.status.textContent.trim()) {
      titlebarStatus.textContent = refs.status.textContent.trim();
      return;
    }
    if (inputPath.value.trim()) {
      titlebarStatus.textContent = outputName.value.trim()
        ? `Loaded ${outputName.value.trim()}`
        : "Image selected.";
      return;
    }
    titlebarStatus.textContent = "Waiting for an image.";
  }
  ui.updateTitlebar = updateTitlebarStatus;

  function setTitlebarMessage(message) {
    refs.status.textContent = "";
    refs.status.dataset.tone = "neutral";
    titlebarStatus.textContent = message;
  }

  function getAutoValue(baseValue, exponent, width, height) {
    const sizeFactor = Math.sqrt(width * height) / REFERENCE_SIZE;
    return Math.max(0, Math.round(baseValue * Math.pow(sizeFactor, exponent)));
  }

  function parseOptionalNumber(value, label) {
    if (value == null || value === "") return null;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new Error(`${label} must be a non-negative number.`);
    }
    return parsed;
  }

  function clampRadius(value, width, height, strip) {
    const imageHeight = Math.max(height - strip, 0);
    return Math.min(value, width, imageHeight);
  }

  function computeDimensions(width, height) {
    const manualTopStrip = parseOptionalNumber(topStrip.value, "top strip");
    const manualRadius = parseOptionalNumber(radius.value, "radius");
    const finalTopStrip =
      manualTopStrip ?? getAutoValue(AUTO_TOP_STRIP_BASE, AUTO_TOP_STRIP_EXPONENT, width, height);
    const autoRadius =
      manualRadius ?? getAutoValue(AUTO_RADIUS_BASE, AUTO_RADIUS_EXPONENT, width, height);
    const finalRadius = clampRadius(autoRadius, width, height, finalTopStrip);
    return {
      finalTopStrip,
      finalRadius,
      topStripAuto: manualTopStrip == null,
      radiusAuto: manualRadius == null,
    };
  }

  function sizeWarning(width, height) {
    return width !== REFERENCE_SIZE || height !== REFERENCE_SIZE
      ? `Widget may look odd if the original image size is not ${REFERENCE_SIZE}x${REFERENCE_SIZE}. Detected ${width}x${height}.`
      : null;
  }

  function applyWidgetEffect(context, width, height, finalTopStrip, finalRadius, source) {
    context.clearRect(0, 0, width, height);
    context.drawImage(source, 0, finalTopStrip, width, height - finalTopStrip);

    if (finalRadius > 0) {
      context.save();
      context.globalCompositeOperation = "destination-out";
      context.beginPath();
      context.moveTo(width - finalRadius, finalTopStrip);
      context.lineTo(width, finalTopStrip);
      context.lineTo(width, finalTopStrip + finalRadius);
      context.arc(width - finalRadius, finalTopStrip + finalRadius, finalRadius, 0, -Math.PI / 2, true);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  
  
  
  
  
  
  
  
  function hardenAlphaForGif(canvas, threshold = 128) {
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    for (let i = 3; i < d.length; i += 4) {
      d[i] = d[i] >= threshold ? 255 : 0;
    }
    context.putImageData(imageData, 0, 0);
    return canvas;
  }

  function setSelectedFile(file) {
    selectedFile = file;
    clearObjectUrl(selectedInputUrl);
    selectedInputUrl = file ? URL.createObjectURL(file) : "";
  }

  function resetResultState() {
    lastResult = null;
    downloadButton.disabled = true;
  }

  function isWebpInput(fileName) {
    return /\.webp$/i.test(fileName);
  }

  
  
  async function encodeCanvas(canvas, format) {
    if (format === "png") {
      return { blob: await canvasToBlob(canvas, "image/png"), mimeType: "image/png" };
    }
    if (format === "jpg") {
      
      
      const flat = flattenCanvasOnWhite(canvas);
      return { blob: await canvasToBlob(flat, "image/jpeg", 0.92), mimeType: "image/jpeg" };
    }
    if (format === "webp") {
      return { blob: await canvasToBlob(canvas, "image/webp", 0.92), mimeType: "image/webp" };
    }
    if (format === "gif") {
      hardenAlphaForGif(canvas);
      const modernGif = await loadModernGif();
      const output = await modernGif.encode({
        width: canvas.width,
        height: canvas.height,
        frames: [{ data: canvas, delay: 0 }],
        maxColors: highQualityAnimated.checked ? 255 : 128,
        loop: 0,
      });
      return { blob: new Blob([output], { type: "image/gif" }), mimeType: "image/gif" };
    }
    throw new Error(`Unsupported output format: ${format}`);
  }

  async function runStill(file, format) {
    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = await loadImageElement(sourceUrl);
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const { finalTopStrip, finalRadius, topStripAuto, radiusAuto } = computeDimensions(width, height);

      ui.setProgressState(true, 30, "Preparing image (30%)");
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available in this browser.");
      applyWidgetEffect(context, width, height, finalTopStrip, finalRadius, image);

      ui.setProgressState(true, 80, "Encoding image (80%)");
      const { blob } = await encodeCanvas(canvas, format);

      clearObjectUrl(outputUrl);
      outputUrl = URL.createObjectURL(blob);
      ui.setProgressState(true, 100, "Done (100%)");

      return {
        outputName: outputName.value.trim() || getSuggestedOutputName(file.name, format),
        previewUrl: outputUrl,
        width,
        height,
        topStrip: finalTopStrip,
        radius: finalRadius,
        autoCalculated: topStripAuto && radiusAuto,
        frameCount: 1,
        animated: false,
        warning: [
          sizeWarning(width, height),
          isWebpInput(file.name) && format === "gif" ? "Animated WEBP input is read as a single still frame." : null,
        ].filter(Boolean).join(" ") || null,
      };
    } finally {
      clearObjectUrl(sourceUrl);
    }
  }

  async function runAnimatedGif(file, format) {
    let modernGif;
    try {
      modernGif = await loadModernGif();
    } catch (error) {
      throw new Error(`GIF engine failed to load (${error?.message ?? error}). Check your connection and reload the page.`);
    }

    ui.setProgressState(true, 5, "Reading GIF (5%)");
    const buffer = await file.arrayBuffer();
    const gifInfo = modernGif.decode(buffer);
    const width = gifInfo.width;
    const height = gifInfo.height;
    const { finalTopStrip, finalRadius, topStripAuto, radiusAuto } = computeDimensions(width, height);

    ui.setProgressState(true, 15, "Decoding frames (15%)");
    const decodedFrames = await modernGif.decodeFrames(buffer);
    const totalFrames = decodedFrames.length || 1;

    if (format !== "gif") {
      
      const frame = decodedFrames[0];
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = frame.width;
      frameCanvas.height = frame.height;
      frameCanvas.getContext("2d").putImageData(
        new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0
      );

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = width;
      outputCanvas.height = height;
      applyWidgetEffect(outputCanvas.getContext("2d"), width, height, finalTopStrip, finalRadius, frameCanvas);

      ui.setProgressState(true, 80, "Encoding image (80%)");
      const { blob } = await encodeCanvas(outputCanvas, format);
      clearObjectUrl(outputUrl);
      outputUrl = URL.createObjectURL(blob);
      ui.setProgressState(true, 100, "Done (100%)");

      return {
        outputName: outputName.value.trim() || getSuggestedOutputName(file.name, format),
        previewUrl: outputUrl,
        width, height,
        topStrip: finalTopStrip,
        radius: finalRadius,
        autoCalculated: topStripAuto && radiusAuto,
        frameCount: 1,
        animated: false,
        warning: [
          sizeWarning(width, height),
          `Source GIF has ${totalFrames} frames — only the first frame was used because ${format.toUpperCase()} doesn't support animation.`,
        ].filter(Boolean).join(" "),
      };
    }

    const outputFrames = [];
    for (let index = 0; index < decodedFrames.length; index++) {
      const frame = decodedFrames[index];
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = frame.width;
      frameCanvas.height = frame.height;
      frameCanvas.getContext("2d").putImageData(
        new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0
      );

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = width;
      outputCanvas.height = height;
      applyWidgetEffect(outputCanvas.getContext("2d"), width, height, finalTopStrip, finalRadius, frameCanvas);

      hardenAlphaForGif(outputCanvas);
      outputFrames.push({ data: outputCanvas, delay: frame.delay ?? 100 });

      const percent = 15 + Math.round(((index + 1) / totalFrames) * 65);
      ui.setProgressState(true, percent, `Preparing frames ${index + 1}/${totalFrames} (${percent}%)`);
      
      
      await yieldToUI();
    }

    ui.setProgressState(true, 85, "Encoding GIF (85%)");
    const output = await modernGif.encode({
      width, height,
      frames: outputFrames,
      maxColors: highQualityAnimated.checked ? 255 : 128,
      loop: 0,
    });

    clearObjectUrl(outputUrl);
    const blob = new Blob([output], { type: "image/gif" });
    outputUrl = URL.createObjectURL(blob);
    ui.setProgressState(true, 100, `Encoding frames ${totalFrames}/${totalFrames} (100%)`);

    return {
      outputName: outputName.value.trim() || getSuggestedOutputName(file.name, format),
      previewUrl: outputUrl,
      width, height,
      topStrip: finalTopStrip,
      radius: finalRadius,
      autoCalculated: topStripAuto && radiusAuto,
      frameCount: totalFrames,
      animated: true,
      warning: sizeWarning(width, height),
    };
  }

  async function handleSelectedFile(file) {
    if (!file) return;

    setSelectedFile(file);
    inputPath.value = file.name;
    outputName.value = getSuggestedOutputName(file.name, outputFormat.value);
    resetResultState();

    ui.baseMeta = isWebpInput(file.name)
      ? "Previewing selected image. WEBP exports as a still frame."
      : "Previewing selected image.";

    updateTitlebarStatus();
    ui.setPreviewLoading(true, "");

    try {
      ui.setPreview(selectedInputUrl, "Selected input image");
      ui.setPreviewMeta(ui.baseMeta);
      ui.setStatus("", "neutral");
    } catch (error) {
      ui.setPreviewLoading(false);
      ui.setStatus(`Could not preview image: ${String(error)}`, "error");
    }
  }

  wireImagePicker({
    dropZone: refs.dropZone,
    browseButton,
    fileInput: localFileInput,
    urlInput,
    urlImportButton,
    ui,
    onFile: handleSelectedFile,
  });

  outputName.addEventListener("input", updateTitlebarStatus);

  outputFormat.addEventListener("change", () => {
    if (outputName.value.trim()) {
      outputName.value = replaceExtension(outputName.value.trim(), outputFormat.value);
    }
    updateTitlebarStatus();
  });

  advancedToggleBtn.addEventListener("click", () => {
    const isOpen = advancedPanel.classList.toggle("advanced-panel--open");
    advancedToggleBtn.setAttribute("aria-pressed", String(isOpen));
  });

  processButton.addEventListener("click", async () => {
    if (!selectedFile) {
      ui.setStatus("Choose an input image first.", "error");
      return;
    }

    processButton.disabled = true;
    downloadButton.disabled = true;
    ui.setProgressState(false, 0, "");
    ui.setStatus("", "neutral");
    ui.setPreviewLoading(true, "");

    
    
    
    
    const inputIsAnimatedGif = isGifInput(selectedFile.name);
    const format = inputIsAnimatedGif ? "gif" : outputFormat.value;

    if (inputIsAnimatedGif && outputFormat.value !== "gif") {
      outputFormat.value = "gif";
      outputFormat.dispatchEvent(new Event("change"));
    }

    try {
      const result = inputIsAnimatedGif
        ? await runAnimatedGif(selectedFile, format)
        : await runStill(selectedFile, format);

      lastResult = result;
      downloadButton.disabled = false;

      ui.baseMeta = result.animated
        ? `Previewing output, ${result.frameCount} frames.`
        : "Previewing generated output.";
      ui.setPreview(result.previewUrl, "Processed output image");
      ui.setPreviewMeta(ui.baseMeta);

      if (result.warning) {
        setTitlebarMessage(result.warning);
      } else {
        ui.setStatus("", "success");
      }
    } catch (error) {
      ui.setPreviewLoading(false);
      ui.setProgressState(false, 0, "");
      ui.setStatus(String(error?.message ?? error), "error");
    } finally {
      processButton.disabled = false;
    }
  });

  downloadButton.addEventListener("click", () => {
    if (!lastResult) {
      ui.setStatus("Generate an image before downloading it.", "error");
      return;
    }
    const defaultName = outputName.value.trim() || lastResult.outputName;
    const link = document.createElement("a");
    link.href = lastResult.previewUrl;
    link.download = defaultName;
    link.click();
    setTitlebarMessage(`Downloaded ${defaultName}.`);
  });

  window.addEventListener("beforeunload", () => {
    clearObjectUrl(selectedInputUrl);
    clearObjectUrl(outputUrl);
  });

  ui.clearPreview();
  ui.setStatus("", "neutral");
})();



(function fileConverter() {
  const FORMATS = {
    png: { ext: "png", mime: "image/png", label: "PNG" },
    jpg: { ext: "jpg", mime: "image/jpeg", label: "JPG" },
    webp: { ext: "webp", mime: "image/webp", label: "WEBP" },
    avif: { ext: "avif", mime: "image/avif", label: "AVIF" },
    gif: { ext: "gif", mime: "image/gif", label: "GIF (static)" },
    ico: { ext: "ico", mime: "image/x-icon", label: "ICO (icon)" },
    cur: { ext: "cur", mime: "image/x-icon", label: "CUR (cursor)" },
    bmp: { ext: "bmp", mime: "image/bmp", label: "BMP" },
    tga: { ext: "tga", mime: "image/x-tga", label: "TGA" },
    ppm: { ext: "ppm", mime: "image/x-portable-pixmap", label: "PPM" },
    tiff: { ext: "tiff", mime: "image/tiff", label: "TIFF" },
    svg: { ext: "svg", mime: "image/svg+xml", label: "SVG (wrapped raster)" },
    pdf: { ext: "pdf", mime: "application/pdf", label: "PDF" },
  };

  const refs = {
    dropZone: document.querySelector("#dropZoneConv"),
    previewEmpty: document.querySelector("#previewEmptyConv"),
    previewLoading: document.querySelector("#previewLoadingConv"),
    previewLoadingText: document.querySelector("#previewLoadingTextConv"),
    progressWrap: document.querySelector("#progressWrapConv"),
    progressBar: document.querySelector("#progressBarConv"),
    progressLabel: document.querySelector("#progressLabelConv"),
    previewImage: document.querySelector("#previewImageConv"),
    previewMeta: document.querySelector("#previewMetaConv"),
    status: document.querySelector("#statusConv"),
  };

  const inputPath = document.querySelector("#inputPathConv");
  const outputName = document.querySelector("#outputNameConv");
  const outputFormat = document.querySelector("#outputFormatConv");
  const qualityRow = document.querySelector("#qualityRowConv");
  const qualitySlider = document.querySelector("#qualityConv");
  const qualityValue = document.querySelector("#qualityValueConv");
  const gifNote = document.querySelector("#gifSourceNoteConv");
  const browseButton = document.querySelector("#browseButtonConv");
  const convertButton = document.querySelector("#convertButtonConv");
  const downloadButton = document.querySelector("#downloadButtonConv");
  const localFileInput = document.querySelector("#localFileInputConv");
  const urlInput = document.querySelector("#urlInputConv");
  const urlImportButton = document.querySelector("#urlImportButtonConv");
  const avifOption = outputFormat.querySelector('option[value="avif"]');

  const ui = createPanelUI(refs);

  let selectedFile = null;
  let selectedInputUrl = "";
  let outputUrl = "";
  let lastResult = null;

  
  
  (function detectAvifSupport() {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    probe.toBlob((blob) => {
      if (!blob || blob.size === 0) {
        avifOption.disabled = true;
        avifOption.textContent = "AVIF (not supported in this browser)";
      }
    }, "image/avif");
  })();

  function updateQualityVisibility() {
    const lossy = ["jpg", "webp", "avif"].includes(outputFormat.value);
    qualityRow.hidden = !lossy;
  }

  function updateGifNoteVisibility() {
    gifNote.hidden = !(selectedFile && isGifInput(selectedFile.name));
  }

  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = qualitySlider.value;
  });

  outputFormat.addEventListener("change", () => {
    updateQualityVisibility();
    if (inputPath.value.trim() && outputName.value.trim()) {
      outputName.value = replaceExtension(outputName.value.trim(), FORMATS[outputFormat.value].ext);
    }
  });
  updateQualityVisibility();

  function resetResultState() {
    lastResult = null;
    downloadButton.disabled = true;
  }

  async function handleSelectedFile(file) {
    if (!file) return;

    selectedFile = file;
    clearObjectUrl(selectedInputUrl);
    selectedInputUrl = URL.createObjectURL(file);

    inputPath.value = file.name;
    outputName.value = getSuggestedOutputName(file.name, FORMATS[outputFormat.value].ext);
    resetResultState();
    updateGifNoteVisibility();

    ui.baseMeta = "Previewing selected file.";
    ui.setPreviewLoading(true, "");

    try {
      
      await loadImageElement(selectedInputUrl);
      ui.setPreview(selectedInputUrl, "Selected input image");
      ui.setPreviewMeta(ui.baseMeta);
      ui.setStatus("", "neutral");
    } catch (error) {
      ui.setPreviewLoading(false);
      ui.setPreview(selectedInputUrl, "Selected input image");
      ui.setStatus(
        "This browser can't decode that file as an image. Supported inputs are whatever your browser can display — typically PNG, JPEG, WEBP, GIF, BMP, ICO, and SVG.",
        "error"
      );
    }
  }

  wireImagePicker({
    dropZone: refs.dropZone,
    browseButton,
    fileInput: localFileInput,
    urlInput,
    urlImportButton,
    ui,
    onFile: handleSelectedFile,
  });

  wireMediaDownloader({
    urlInput: document.querySelector("#mediaUrlInput"),
    downloadButton: document.querySelector("#mediaDownloadButton"),
    statusEl: document.querySelector("#mediaDownloadStatus"),
    spinnerEl: document.querySelector("#mediaDownloadSpinner"),
    fallbackWrap: document.querySelector("#mediaDownloadFallback"),
    fallbackTextEl: document.querySelector("#mediaDownloadFallbackText"),
  });

  async function encodeAs(canvas, format, quality) {
    const info = FORMATS[format];

    if (format === "png") return canvasToBlob(canvas, "image/png");
    if (format === "jpg") return canvasToBlob(flattenCanvasOnWhite(canvas), "image/jpeg", quality);
    if (format === "webp") return canvasToBlob(canvas, "image/webp", quality);
    if (format === "avif") return canvasToBlob(canvas, "image/avif", quality);

    if (format === "gif") {
      const modernGif = await loadModernGif();
      const output = await modernGif.encode({
        width: canvas.width,
        height: canvas.height,
        frames: [{ data: canvas, delay: 0 }],
        maxColors: 255,
        loop: 0,
      });
      return new Blob([output], { type: info.mime });
    }

    if (format === "ico" || format === "cur") {
      const iconCanvas = scaleCanvasToMax(canvas, MAX_ICON_SIZE);
      const imageData = getImageData(iconCanvas);
      const bytes = encodeIcoContainer(
        { width: iconCanvas.width, height: iconCanvas.height, data: imageData.data },
        format === "cur"
      );
      return new Blob([bytes], { type: info.mime });
    }

    if (format === "bmp") {
      const imageData = getImageData(canvas);
      return new Blob([encodeBMP({ width: canvas.width, height: canvas.height, data: imageData.data })], { type: info.mime });
    }
    if (format === "tga") {
      const imageData = getImageData(canvas);
      return new Blob([encodeTGA({ width: canvas.width, height: canvas.height, data: imageData.data })], { type: info.mime });
    }
    if (format === "ppm") {
      const imageData = getImageData(canvas);
      return new Blob([encodePPM({ width: canvas.width, height: canvas.height, data: imageData.data })], { type: info.mime });
    }
    if (format === "tiff") {
      const imageData = getImageData(canvas);
      return new Blob([encodeTIFF({ width: canvas.width, height: canvas.height, data: imageData.data })], { type: info.mime });
    }

    if (format === "svg") {
      const pngBlob = await canvasToBlob(canvas, "image/png");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read the encoded PNG."));
        reader.readAsDataURL(pngBlob);
      });
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image width="${canvas.width}" height="${canvas.height}" href="data:image/png;base64,${base64}"/></svg>`;
      return new Blob([svg], { type: info.mime });
    }

    if (format === "pdf") {
      const jpegBlob = await canvasToBlob(flattenCanvasOnWhite(canvas), "image/jpeg", 0.92);
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const bytes = encodePDF(jpegBytes, canvas.width, canvas.height);
      return new Blob([bytes], { type: info.mime });
    }

    throw new Error(`Unsupported output format: ${format}`);
  }

  convertButton.addEventListener("click", async () => {
    if (!selectedFile) {
      ui.setStatus("Choose an input file first.", "error");
      return;
    }

    convertButton.disabled = true;
    downloadButton.disabled = true;
    ui.setProgressState(true, 20, "Decoding source (20%)");
    ui.setStatus("", "neutral");
    ui.setPreviewLoading(true, "");

    const format = outputFormat.value;
    const quality = Number(qualitySlider.value) / 100;

    try {
      const image = await loadImageElement(selectedInputUrl);
      const canvas = drawToCanvas(image, image.naturalWidth, image.naturalHeight);

      ui.setProgressState(true, 60, "Encoding output (60%)");
      const blob = await encodeAs(canvas, format, quality);

      clearObjectUrl(outputUrl);
      outputUrl = URL.createObjectURL(blob);
      ui.setProgressState(true, 100, "Done (100%)");

      const finalName = outputName.value.trim() || getSuggestedOutputName(selectedFile.name, FORMATS[format].ext);
      lastResult = { outputName: finalName, previewUrl: outputUrl };
      downloadButton.disabled = false;

      ui.baseMeta = `Converted to ${FORMATS[format].label}.`;
      ui.setPreview(outputUrl, "Converted output image");
      ui.setPreviewMeta(ui.baseMeta);
      ui.setStatus("", "success");
    } catch (error) {
      ui.setPreviewLoading(false);
      ui.setProgressState(false, 0, "");
      ui.setStatus(String(error?.message ?? error), "error");
    } finally {
      convertButton.disabled = false;
    }
  });

  downloadButton.addEventListener("click", () => {
    if (!lastResult) {
      ui.setStatus("Convert a file before downloading it.", "error");
      return;
    }
    const defaultName = outputName.value.trim() || lastResult.outputName;
    const link = document.createElement("a");
    link.href = lastResult.previewUrl;
    link.download = defaultName;
    link.click();
  });

  window.addEventListener("beforeunload", () => {
    clearObjectUrl(selectedInputUrl);
    clearObjectUrl(outputUrl);
  });

  ui.clearPreview();
  ui.setStatus("", "neutral");
})();



(function advancedEditor() {







const state = {
  file: null,
  originalImage: null,
  canvasW: 0, canvasH: 0,
  rotation: 0,
  flipH: false, flipV: false,
  brightness: 0, contrast: 0, saturation: 0,
  hue: 0, blur: 0, sharpen: 0,
  opacity: 100, exposure: 0, noise: 0, vignette: 0,
  tint: 'none', tintIntensity: 0,
  colorMode: 'normal',
  filter: 'none',
  selectedPreset: null,
  outputFmt: 'png',
  quality: 0.92,
  outputBlob: null,
  aspectRatio: null
};




const canvas        = document.getElementById('advCanvas');
const ctx           = canvas.getContext('2d', { willReadFrequently: true });
const canvasEmpty   = document.getElementById('canvasEmpty');
const statusBar     = document.getElementById('statusBar');
const dropZoneAdv   = document.getElementById('dropZoneAdv');
const advFileInput  = document.getElementById('advFileInput');
const advBrowseBtn  = document.getElementById('advBrowseBtn');
const advPasteUrlBtn = document.getElementById('advPasteUrlBtn');
const advUrlInput   = document.getElementById('advUrlInput');
const advFetchBtn   = document.getElementById('advFetchBtn');
const urlRow        = document.getElementById('urlRow');
const advOutputName = document.getElementById('advOutputName');
const advApplyBtn   = document.getElementById('advApplyBtn');
const advDownloadBtn = document.getElementById('advDownloadBtn');
const qualitySlider = document.getElementById('qualitySlider');
const qualityVal    = document.getElementById('qualityVal');





function updateSliderFill(el) {
  const min = parseFloat(el.min) || 0;
  const max = parseFloat(el.max) || 100;
  const val = parseFloat(el.value) || 0;
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  el.style.setProperty('--pct', pct + '%');
}

function initAllSliderFills() {
  document.querySelectorAll('input[type="range"]').forEach(el => {
    updateSliderFill(el);
    el.addEventListener('input', () => updateSliderFill(el));
  });
}
initAllSliderFills();




const PRESETS = {
  discord: [
    { name: 'Widget',         w: 512,  h: 512  },
    { name: 'Banner',         w: 960,  h: 540  },
    { name: 'Avatar',         w: 128,  h: 128  },
    { name: 'Server Icon',    w: 512,  h: 512  },
    { name: 'Emoji',          w: 128,  h: 128  },
    { name: 'Sticker',        w: 320,  h: 320  },
    { name: 'Profile Banner', w: 600,  h: 240  },
    { name: 'Store Art',      w: 1024, h: 512  },
    { name: 'Role Icon',      w: 64,   h: 64   },
    { name: 'App Icon',       w: 1024, h: 1024 },
  ],
  social: [
    { name: 'Instagram',      w: 1080, h: 1080 },
    { name: 'IG Story',       w: 1080, h: 1920 },
    { name: 'IG Landscape',   w: 1080, h: 566  },
    { name: 'Twitter Post',   w: 1200, h: 675  },
    { name: 'Twitter Header', w: 1500, h: 500  },
    { name: 'Facebook Post',  w: 1200, h: 630  },
    { name: 'YouTube Thumb',  w: 1280, h: 720  },
    { name: 'LinkedIn Banner',w: 1584, h: 396  },
    { name: 'TikTok',         w: 1080, h: 1920 },
    { name: 'Pinterest',      w: 1000, h: 1500 },
    { name: 'OG Image',       w: 1200, h: 630  },
    { name: 'Open Graph',     w: 1200, h: 628  },
  ],
  print: [
    { name: 'A4 72dpi',      w: 595,  h: 842  },
    { name: 'A4 150dpi',     w: 1240, h: 1754 },
    { name: 'A4 300dpi',     w: 2480, h: 3508 },
    { name: 'Letter',        w: 2550, h: 3300 },
    { name: 'A5',            w: 1748, h: 2480 },
    { name: 'Business Card', w: 1004, h: 650  },
    { name: 'Postcard',      w: 1871, h: 1307 },
    { name: 'Poster A3',     w: 3508, h: 4961 },
    { name: 'Square 12"',    w: 3600, h: 3600 },
  ],
  game: [
    { name: 'HD 720p',      w: 1280, h: 720  },
    { name: 'FHD 1080p',    w: 1920, h: 1080 },
    { name: 'QHD 1440p',    w: 2560, h: 1440 },
    { name: '4K UHD',       w: 3840, h: 2160 },
    { name: 'Game Icon',    w: 256,  h: 256  },
    { name: 'Sprite 32',    w: 32,   h: 32   },
    { name: 'Sprite 64',    w: 64,   h: 64   },
    { name: 'Sprite 128',   w: 128,  h: 128  },
    { name: 'Texture 512',  w: 512,  h: 512  },
    { name: 'Texture 1K',   w: 1024, h: 1024 },
    { name: 'Texture 2K',   w: 2048, h: 2048 },
    { name: 'Texture 4K',   w: 4096, h: 4096 },
    { name: 'Steam Hero',   w: 616,  h: 353  },
    { name: 'Itch Cover',   w: 630,  h: 500  },
  ],
  custom: []
};




function getThemeAccentColor() {
  // Reads the current theme's accent color from the --violet CSS variable
  // (defined per-theme in styles.css) rather than hardcoding a color here,
  // so canvas-drawn UI stays in sync with whatever theme is active — e.g.
  // White mode sets --violet to black, Discord sets it to blurple, etc.
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--violet').trim();
  return v || '#8b5cf6';
}

function buildThumb(w, h, size = 44) {
  const c = document.createElement('canvas');
  const aspect = w / h;
  let tw, th;
  if (aspect >= 1) { tw = size; th = Math.round(size / aspect); }
  else             { th = size; tw = Math.round(size * aspect); }
  tw = Math.max(tw, 4); th = Math.max(th, 4);
  c.width = tw; c.height = th;
  const cx = c.getContext('2d');
  const accent = getThemeAccentColor();
  cx.globalAlpha = 0.15;
  cx.fillStyle = accent;
  cx.fillRect(0, 0, tw, th);
  cx.globalAlpha = 0.35;
  cx.strokeStyle = accent;
  cx.strokeRect(0.5, 0.5, tw - 1, th - 1);
  cx.globalAlpha = 1;
  return c;
}

function renderAllPresetGrids() {
  ['discord', 'social', 'print', 'game', 'custom'].forEach(renderPresetGrid);
}

function renderPresetGrid(category) {
  const key = category.charAt(0).toUpperCase() + category.slice(1);
  const grid = document.getElementById(`presetGrid${key}`);
  if (!grid) return;
  grid.innerHTML = '';
  (PRESETS[category] || []).forEach((p, i) => {
    const tile = document.createElement('div');
    tile.className = 'preset-tile';
    tile.dataset.category = category;
    tile.dataset.index = i;

    const thumb = buildThumb(p.w, p.h);
    thumb.className = 'preset-thumb';
    tile.appendChild(thumb);

    const name = document.createElement('div');
    name.className = 'preset-name';
    name.textContent = p.name;

    const size = document.createElement('div');
    size.className = 'preset-size';
    size.textContent = `${p.w}×${p.h}`;

    tile.appendChild(name);
    tile.appendChild(size);
    tile.addEventListener('click', () => applyPreset(category, i));
    grid.appendChild(tile);
  });
}

renderAllPresetGrids();

function applyPreset(category, index) {
  const p = PRESETS[category][index];
  if (!p) return;
  document.querySelectorAll('.preset-tile').forEach(t => t.classList.remove('selected'));
  const key  = category.charAt(0).toUpperCase() + category.slice(1);
  const grid = document.getElementById(`presetGrid${key}`);
  if (grid) grid.querySelectorAll('.preset-tile')[index]?.classList.add('selected');
  document.getElementById('canvasW').value = p.w;
  document.getElementById('canvasH').value = p.h;
  state.canvasW = p.w;
  state.canvasH = p.h;
  state.aspectRatio = p.w / p.h;
  setStatus(`Canvas → ${p.name} (${p.w}×${p.h})`, 'info');
  if (state.originalImage) renderCanvas();
}




document.getElementById('presetTabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('#presetTabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const key = tab.charAt(0).toUpperCase() + tab.slice(1);
  document.getElementById(`presetPanel${key}`)?.classList.add('active');
});


document.getElementById('addCustomPresetBtn').addEventListener('click', () => {
  const name = document.getElementById('customPresetName').value.trim() || 'Custom';
  const w    = parseInt(document.getElementById('customPresetW').value) || 800;
  const h    = parseInt(document.getElementById('customPresetH').value) || 600;
  PRESETS.custom.push({ name, w, h });
  renderPresetGrid('custom');
  document.getElementById('customPresetName').value = '';
  document.getElementById('customPresetW').value    = '';
  document.getElementById('customPresetH').value    = '';
  setStatus(`Added custom preset: ${name} (${w}×${h})`, 'success');
});


document.getElementById('canvasW').addEventListener('input', () => {
  if (document.getElementById('lockAspect').checked && state.aspectRatio) {
    const w = parseInt(document.getElementById('canvasW').value);
    if (w) document.getElementById('canvasH').value = Math.round(w / state.aspectRatio);
  }
});
document.getElementById('canvasH').addEventListener('input', () => {
  if (document.getElementById('lockAspect').checked && state.aspectRatio) {
    const h = parseInt(document.getElementById('canvasH').value);
    if (h) document.getElementById('canvasW').value = Math.round(h * state.aspectRatio);
  }
});

document.getElementById('applyCanvasSizeBtn').addEventListener('click', () => {
  const w = parseInt(document.getElementById('canvasW').value);
  const h = parseInt(document.getElementById('canvasH').value);
  if (!w || !h || w < 1 || h < 1) { setStatus('Enter valid width and height.', 'error'); return; }
  state.canvasW = w; state.canvasH = h;
  if (document.getElementById('lockAspect').checked) state.aspectRatio = w / h;
  if (state.originalImage) renderCanvas();
  setStatus(`Canvas resized to ${w}×${h}`, 'success');
});




document.getElementById('formatChipsAE').addEventListener('click', e => {
  const chip = e.target.closest('.format-chip');
  if (!chip) return;
  document.querySelectorAll('#formatChipsAE .format-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  state.outputFmt = chip.dataset.fmt;
  updateOutputName();
  updateBudget();
});

function updateOutputName() {
  const current = advOutputName.value || 'output';
  const stem = current.replace(/\.[^.]+$/, '');
  const extMap = { png:'png', jpg:'jpg', webp:'webp', bmp:'bmp', gif:'gif', tiff:'tiff', ico:'ico', avif:'avif' };
  advOutputName.value = stem + '.' + (extMap[state.outputFmt] || 'png');
}




qualitySlider.addEventListener('input', () => {
  state.quality = qualitySlider.value / 100;
  qualityVal.textContent = qualitySlider.value;
  updateBudget();
});




const adjSliders = [
  { id: 'adjBrightness', key: 'brightness', vId: 'vBrightness', fmt: v => v },
  { id: 'adjContrast',   key: 'contrast',   vId: 'vContrast',   fmt: v => v },
  { id: 'adjSaturation', key: 'saturation', vId: 'vSaturation', fmt: v => v },
  { id: 'adjHue',        key: 'hue',        vId: 'vHue',        fmt: v => v + '°' },
  { id: 'adjBlur',       key: 'blur',       vId: 'vBlur',       fmt: v => v + 'px' },
  { id: 'adjSharpen',    key: 'sharpen',    vId: 'vSharpen',    fmt: v => v },
  { id: 'adjOpacity',    key: 'opacity',    vId: 'vOpacity',    fmt: v => v + '%' },
  { id: 'adjExposure',   key: 'exposure',   vId: 'vExposure',   fmt: v => v },
  { id: 'adjNoise',      key: 'noise',      vId: 'vNoise',      fmt: v => v },
  { id: 'adjVignette',   key: 'vignette',   vId: 'vVignette',   fmt: v => v },
];

adjSliders.forEach(({ id, key, vId, fmt }) => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    state[key] = parseFloat(el.value);
    document.getElementById(vId).textContent = fmt(el.value);
    if (state.originalImage) renderCanvas();
  });
});

document.getElementById('resetAdjBtn').addEventListener('click', () => {
  adjSliders.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    el.value = el.defaultValue;
    state[key] = parseFloat(el.defaultValue);
  });
  adjSliders.forEach(({ vId, fmt, id }) => {
    document.getElementById(vId).textContent = fmt(document.getElementById(id).defaultValue);
  });
  if (state.originalImage) renderCanvas();
  setStatus('Adjustments reset.', 'info');
});




const rotSlider      = document.getElementById('rotationSlider');
const rotDisplay     = document.getElementById('rotationDisplay');
const vRotation      = document.getElementById('vRotation');
const customRotation = document.getElementById('customRotation');

function setRotation(deg) {
  state.rotation = ((deg % 360) + 360) % 360;
  rotSlider.value          = state.rotation;
  rotDisplay.textContent   = state.rotation + '°';
  vRotation.textContent    = state.rotation + '°';
  customRotation.value     = state.rotation;
  updateRotationRing();
  if (state.originalImage) renderCanvas();
}


window.setRotation = setRotation;

rotSlider.addEventListener('input', () => setRotation(parseInt(rotSlider.value)));
customRotation.addEventListener('change', () => setRotation(parseInt(customRotation.value) || 0));

function updateRotationRing() {
  document.getElementById('rotationHandle').style.transform = `rotate(${state.rotation}deg)`;
}


let ringDragging = false;
const ring = document.getElementById('rotationRing');
ring.addEventListener('mousedown', e => { ringDragging = true; e.preventDefault(); });
document.addEventListener('mousemove', e => {
  if (!ringDragging) return;
  const rect  = ring.getBoundingClientRect();
  const cx    = rect.left + rect.width / 2;
  const cy    = rect.top  + rect.height / 2;
  const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
  setRotation(Math.round((angle + 360) % 360));
});
document.addEventListener('mouseup', () => { ringDragging = false; });




document.getElementById('flipHBtn').addEventListener('click', () => {
  state.flipH = !state.flipH;
  document.getElementById('flipHBtn').style.opacity = state.flipH ? '1' : '0.6';
  if (state.originalImage) renderCanvas();
});
document.getElementById('flipVBtn').addEventListener('click', () => {
  state.flipV = !state.flipV;
  document.getElementById('flipVBtn').style.opacity = state.flipV ? '1' : '0.6';
  if (state.originalImage) renderCanvas();
});




document.getElementById('tintSwatches').addEventListener('click', e => {
  const sw = e.target.closest('.swatch');
  if (!sw) return;
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  sw.classList.add('selected');
  state.tint = sw.dataset.tint;
  if (state.originalImage) renderCanvas();
});
document.getElementById('tintIntensity').addEventListener('input', e => {
  state.tintIntensity = parseInt(e.target.value);
  if (state.originalImage) renderCanvas();
});
document.getElementById('customTintColor').addEventListener('input', e => {
  state.tint = e.target.value;
  if (state.originalImage) renderCanvas();
});




document.getElementById('colorModeChips').addEventListener('click', e => {
  const chip = e.target.closest('.format-chip');
  if (!chip) return;
  document.querySelectorAll('#colorModeChips .format-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  state.colorMode = chip.dataset.mode;
  if (state.originalImage) renderCanvas();
});




const FILTERS = [
  { name: 'None',       css: 'none' },
  { name: 'Warm',       css: 'sepia(0.4) saturate(1.3) hue-rotate(-10deg)' },
  { name: 'Cool',       css: 'hue-rotate(200deg) saturate(0.8)' },
  { name: 'Faded',      css: 'contrast(0.85) brightness(1.1) saturate(0.7)' },
  { name: 'Vivid',      css: 'saturate(1.8) contrast(1.1)' },
  { name: 'Matte',      css: 'contrast(0.9) brightness(1.05) saturate(0.6)' },
  { name: 'Cinematic',  css: 'contrast(1.2) saturate(0.8) brightness(0.95)' },
  { name: 'Noir',       css: 'grayscale(1) contrast(1.3)' },
  { name: 'Retro',      css: 'sepia(0.6) contrast(1.2) saturate(1.4)' },
  { name: 'Chrome',     css: 'contrast(1.4) brightness(1.1) saturate(1.3)' },
  { name: 'Lo‑fi',      css: 'contrast(1.1) saturate(1.4) hue-rotate(20deg)' },
  { name: 'Summer',     css: 'brightness(1.1) saturate(1.4) hue-rotate(-15deg)' },
  { name: 'Ice',        css: 'hue-rotate(180deg) saturate(0.9) brightness(1.1)' },
  { name: 'Amber',      css: 'sepia(0.7) hue-rotate(-20deg) saturate(1.5)' },
];

function buildFilterStrip() {
  const strip = document.getElementById('filterStrip');
  strip.innerHTML = '';
  FILTERS.forEach((f, i) => {
    const tile = document.createElement('div');
    tile.className = 'filter-tile' + (i === 0 ? ' selected' : '');

    const c = document.createElement('canvas');
    c.width = 56; c.height = 56;

    const label = document.createElement('div');
    label.className = 'filter-tile-name';
    label.textContent = f.name;

    tile.appendChild(c);
    tile.appendChild(label);
    tile.addEventListener('click', () => {
      document.querySelectorAll('.filter-tile').forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      state.filter = f.css;
      document.getElementById('activeFilterLabel').textContent =
        f.name === 'None' ? 'None applied' : f.name;
      if (state.originalImage) renderCanvas();
    });
    strip.appendChild(tile);
    tile._canvas = c;
    tile._filter = f.css;
  });
}

function updateFilterPreviews() {
  if (!state.originalImage) return;
  document.querySelectorAll('.filter-tile').forEach(tile => {
    const c = tile._canvas;
    if (!c) return;
    const cx = c.getContext('2d');
    cx.save();
    cx.filter = tile._filter || 'none';
    cx.drawImage(state.originalImage, 0, 0, 56, 56);
    cx.restore();
  });
}

buildFilterStrip();




advBrowseBtn.addEventListener('click', () => advFileInput.click());
advFileInput.addEventListener('change', () => {
  const f = advFileInput.files?.[0];
  if (f) loadFile(f);
});

advPasteUrlBtn.addEventListener('click', () => {
  urlRow.style.display = urlRow.style.display === 'none' ? 'flex' : 'none';
});
advFetchBtn.addEventListener('click', () => fetchUrl(advUrlInput.value.trim()));
advUrlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') fetchUrl(advUrlInput.value.trim());
});


dropZoneAdv.addEventListener('dragover', e => {
  e.preventDefault();
  dropZoneAdv.classList.add('drag-over');
});
dropZoneAdv.addEventListener('dragleave', () => {
  dropZoneAdv.classList.remove('drag-over');
});
dropZoneAdv.addEventListener('drop', e => {
  e.preventDefault();
  dropZoneAdv.classList.remove('drag-over');
  const f = e.dataTransfer?.files?.[0];
  if (f) { loadFile(f); return; }
  const url = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
  if (url) fetchUrl(url.trim());
});
dropZoneAdv.addEventListener('click', e => {
  if (e.target === dropZoneAdv || e.target === canvasEmpty || canvasEmpty.contains(e.target)) {
    advFileInput.click();
  }
});


document.addEventListener('paste', e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) { loadFile(f); break; }
    }
  }
});

async function fetchUrl(url) {
  if (!url) return;
  setStatus('Fetching…', 'info');
  try {
    const res = await fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Not an image');
    const name = url.split('/').pop()?.split('?')[0] || 'image.png';
    loadFile(new File([blob], name, { type: blob.type }));
    urlRow.style.display = 'none';
  } catch (err) {
    setStatus('Could not fetch URL: ' + err.message, 'error');
  }
}

function loadFile(file) {
  state.file = file;
  const objUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.originalImage = img;
    if (!state.canvasW) {
      state.canvasW     = img.naturalWidth;
      state.canvasH     = img.naturalHeight;
      state.aspectRatio = img.naturalWidth / img.naturalHeight;
      document.getElementById('canvasW').value = state.canvasW;
      document.getElementById('canvasH').value = state.canvasH;
    }
    advOutputName.value    = getSuggestedName(file.name);
    advApplyBtn.disabled   = false;
    canvasEmpty.hidden     = true;
    canvas.style.display   = 'block';
    renderCanvas();
    updateFilterPreviews();
    updateBudget(file.size);
    setStatus(`Loaded: ${file.name} (${img.naturalWidth}×${img.naturalHeight})`, 'success');
    URL.revokeObjectURL(objUrl);
  };
  img.onerror = () => {
    setStatus('Could not decode image.', 'error');
    URL.revokeObjectURL(objUrl);
  };
  img.src = objUrl;
}

function getSuggestedName(fileName) {
  const stem   = fileName.replace(/\.[^.]+$/, '') || 'output';
  const extMap = { png:'png', jpg:'jpg', webp:'webp', bmp:'bmp', gif:'gif', tiff:'tiff', ico:'ico', avif:'avif' };
  return stem + '-edited.' + (extMap[state.outputFmt] || 'png');
}




function buildCSSFilter() {
  const parts = [];
  if (state.brightness) parts.push(`brightness(${1 + state.brightness / 100})`);
  if (state.contrast)   parts.push(`contrast(${1 + state.contrast / 100})`);
  if (state.saturation) parts.push(`saturate(${1 + state.saturation / 100})`);
  if (state.hue)        parts.push(`hue-rotate(${state.hue}deg)`);
  if (state.blur)       parts.push(`blur(${state.blur}px)`);
  if (state.exposure)   parts.push(`brightness(${1 + state.exposure / 200})`);
  if (state.filter && state.filter !== 'none') parts.push(state.filter);
  return parts.join(' ') || 'none';
}

function renderCanvas() {
  const img = state.originalImage;
  if (!img) return;

  const W = state.canvasW || img.naturalWidth;
  const H = state.canvasH || img.naturalHeight;
  canvas.width  = W;
  canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  
  if (!document.getElementById('canvasBgTransparent').checked) {
    ctx.fillStyle = document.getElementById('canvasBgColor').value;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.save();
  ctx.globalAlpha = state.opacity / 100;
  ctx.filter      = buildCSSFilter();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  ctx.drawImage(img, -W / 2, -H / 2, W, H);
  ctx.restore();

  
  if (['grayscale','sepia','invert','duotone','posterize'].includes(state.colorMode)) {
    applyColorMode(W, H);
  }
  if (state.noise   > 0) applyNoise(W, H);
  if (state.sharpen > 0) applySharpen(W, H);

  
  if (state.tint !== 'none' && state.tintIntensity > 0) {
    ctx.save();
    ctx.globalAlpha = (state.tintIntensity / 100) * 0.6;
    ctx.fillStyle   = state.tint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (state.vignette > 0) applyVignette(W, H);

  document.getElementById('canvasDimLabel').textContent = `${W}×${H}`;
}

function applyColorMode(W, H) {
  const imgData = ctx.getImageData(0, 0, W, H);
  const d       = imgData.data;
  const mode    = state.colorMode;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];
    if (mode === 'grayscale') {
      const lum = 0.299*r + 0.587*g + 0.114*b;
      d[i] = d[i+1] = d[i+2] = lum;
    } else if (mode === 'sepia') {
      d[i]   = Math.min(255, r*0.393 + g*0.769 + b*0.189);
      d[i+1] = Math.min(255, r*0.349 + g*0.686 + b*0.168);
      d[i+2] = Math.min(255, r*0.272 + g*0.534 + b*0.131);
    } else if (mode === 'invert') {
      d[i] = 255 - r; d[i+1] = 255 - g; d[i+2] = 255 - b;
    } else if (mode === 'duotone') {
      const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
      d[i]   = lum * 88  + (1 - lum) * 88;
      d[i+1] = lum * 101 + (1 - lum) * 0;
      d[i+2] = lum * 242 + (1 - lum) * 120;
    } else if (mode === 'posterize') {
      const levels = 4;
      d[i]   = Math.round(r / 255 * levels) / levels * 255;
      d[i+1] = Math.round(g / 255 * levels) / levels * 255;
      d[i+2] = Math.round(b / 255 * levels) / levels * 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function applyNoise(W, H) {
  const imgData  = ctx.getImageData(0, 0, W, H);
  const d        = imgData.data;
  const strength = state.noise;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * strength * 2;
    d[i]   = Math.min(255, Math.max(0, d[i]   + n));
    d[i+1] = Math.min(255, Math.max(0, d[i+1] + n));
    d[i+2] = Math.min(255, Math.max(0, d[i+2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
}

function applySharpen(W, H) {
  const amount  = state.sharpen;
  const kernel  = [
    0,       -amount, 0,
    -amount, 1 + 4 * amount, -amount,
    0,       -amount, 0
  ];
  const imgData = ctx.getImageData(0, 0, W, H);
  const src     = new Uint8ClampedArray(imgData.data);
  const dst     = imgData.data;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++)
            val += src[((y + ky) * W + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
        dst[idx + c] = Math.min(255, Math.max(0, val));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function applyVignette(W, H) {
  const strength = state.vignette / 100;
  const grad     = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}




advApplyBtn.addEventListener('click', async () => {
  if (!state.originalImage) return;
  renderCanvas();

  
  
  
  
  
  if (state.outputFmt === 'gif') {
    advApplyBtn.disabled = true;
    advDownloadBtn.disabled = true;
    setStatus('Encoding GIF…', 'info');
    try {
      const modernGif = await loadModernGif();
      const output = await modernGif.encode({
        width: canvas.width,
        height: canvas.height,
        frames: [{ data: canvas, delay: 0 }],
        maxColors: 255,
        loop: 0,
      });
      const blob = new Blob([output], { type: 'image/gif' });
      state.outputBlob = blob;
      advDownloadBtn.disabled = false;
      updateBudget(state.file?.size, blob.size);
      setStatus(`Ready — ${fmtBytes(blob.size)} (GIF)`, 'success');
    } catch (error) {
      state.outputBlob = null;
      advDownloadBtn.disabled = true;
      setStatus(`GIF encoding failed: ${error?.message ?? error}`, 'error');
    } finally {
      advApplyBtn.disabled = false;
    }
    return;
  }

  const mime = fmtToMime(state.outputFmt);
  await new Promise(resolve => {
    canvas.toBlob(blob => {
      state.outputBlob         = blob;
      advDownloadBtn.disabled  = !blob;
      if (blob) {
        updateBudget(state.file?.size, blob.size);
        setStatus(`Ready — ${fmtBytes(blob.size)} (${state.outputFmt.toUpperCase()})`, 'success');
      }
      resolve();
    }, mime, state.quality);
  });
});

advDownloadBtn.addEventListener('click', () => {
  if (!state.outputBlob) return;
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(state.outputBlob);
  a.download = advOutputName.value || 'output.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setStatus(`Downloaded: ${a.download}`, 'success');
});

function fmtToMime(fmt) {
  const map = {
    png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp',
    gif: 'image/gif', bmp: 'image/bmp',  tiff: 'image/tiff',
    ico: 'image/x-icon', avif: 'image/avif'
  };
  return map[fmt] || 'image/png';
}




const TIERS = [
  { id: 'free',       name: 'Free / DM',        limit: 25  * 1024 * 1024 },
  { id: 'nitrobasic', name: 'Nitro Basic',       limit: 50  * 1024 * 1024 },
  { id: 'nitro',      name: 'Nitro',             limit: 500 * 1024 * 1024 },
  { id: 'boostlvl2',  name: 'Server Boost Lv.2', limit: 50  * 1024 * 1024 },
  { id: 'boostlvl3',  name: 'Server Boost Lv.3', limit: 100 * 1024 * 1024 },
];

function fmtBytes(b) {
  if (!b)              return '—';
  if (b < 1024)        return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

function updateBudget(originalSize, outputSize) {
  const size = outputSize || originalSize || state.file?.size;
  if (!size) return;

  document.getElementById('budgetCurrentSize').textContent = fmtBytes(originalSize || state.file?.size || size);
  document.getElementById('budgetDimensions').textContent  = state.originalImage
    ? `${state.originalImage.naturalWidth}×${state.originalImage.naturalHeight} px`
    : '';
  document.getElementById('budgetEstSize').textContent     = outputSize ? fmtBytes(outputSize) : '(apply first)';

  if (originalSize && outputSize) {
    const saved = originalSize - outputSize;
    document.getElementById('budgetSavings').textContent = saved > 0
      ? `Saved ${fmtBytes(saved)} (${((saved / originalSize) * 100).toFixed(1)}% smaller)`
      : `${fmtBytes(Math.abs(saved))} larger than original`;
  }

  const pct = Math.min(100, (size / TIERS[0].limit) * 100);
  const bar  = document.getElementById('budgetBarEl');
  bar.style.width      = pct + '%';
  bar.style.background = pct > 90 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e';
  document.getElementById('budgetPct').textContent = pct.toFixed(1) + '% of Free tier';

  TIERS.forEach(tier => {
    const el     = document.getElementById('tier-' + tier.id);
    const sizeEl = document.getElementById('tierSize-' + tier.id);
    if (!el || !sizeEl) return;
    el.classList.remove('reachable', 'warning', 'over');
    sizeEl.textContent = fmtBytes(size);
    const ratio = size / tier.limit;
    if (ratio <= 0.5)      { el.classList.add('reachable'); sizeEl.style.color = '#6ee7b7'; }
    else if (ratio <= 0.9) { el.classList.add('warning');   sizeEl.style.color = '#fde68a'; }
    else                   { el.classList.add('over');       sizeEl.style.color = '#fca5a5'; }
  });

  
  const tips = [];
  if (size > 25*1024*1024)  tips.push({ tone:'warn', text:"File exceeds 25 MB — won't upload on free Discord." });
  if (state.outputFmt === 'png' && size > 1024*1024) tips.push({ tone:'info', text:'Try JPG or WEBP — often 60–80% smaller than PNG for photos.' });
  if (state.outputFmt === 'bmp') tips.push({ tone:'info', text:'BMP has no compression. Convert to PNG or WEBP for Discord.' });
  if (state.quality > 0.9 && ['jpg','webp'].includes(state.outputFmt)) tips.push({ tone:'info', text:'Lower quality to 75–85% for a much smaller file with little visible difference.' });
  if (state.canvasW > 2000 || state.canvasH > 2000) tips.push({ tone:'info', text:'Images wider than 2000px are resized by Discord anyway — consider resizing before upload.' });
  if (size < 500*1024) tips.push({ tone:'good', text:'Under 500 KB — great for fast Discord delivery on any plan.' });
  if (tips.length === 0) tips.push({ tone:'good', text:'File size looks reasonable for Discord uploads.' });

  document.getElementById('budgetTips').innerHTML = tips
    .map(t => `<div class="tip-line tip-${t.tone}">${t.text}</div>`)
    .join('');
}




function setStatus(msg, tone = 'neutral') {
  statusBar.textContent  = msg;
  statusBar.dataset.tone = tone;
  const ts = document.getElementById('titlebarStatus');
  if (ts) ts.textContent = msg;
}




document.getElementById('canvasBgColor').addEventListener('input',     () => { if (state.originalImage) renderCanvas(); });
document.getElementById('canvasBgTransparent').addEventListener('change', () => { if (state.originalImage) renderCanvas(); });
})();


/* ══════════════════════════════════════════════════════════════════
   Theme Switcher logic
   ------------------------------------------------------------------
   Requires:
     - the theme CSS below in styles.css (variable palettes + all UI
       styling, appended in the "Theme Switcher styles" block)
     - an empty <div id="themeSwitcher"></div> somewhere in the page
     - the tiny inline snippet in <head> that sets data-theme on
       <html> before first paint (prevents a flash of the wrong theme)

   Everything else — the trigger button, the popover, the White Mode
   liability waiver modal — is built here and appended to the DOM.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_KEY = 'wis-theme';
  var DEFAULT_THEME = 'original';

  var THEMES = [
    { id: 'original', name: '𝙾𝚛𝚒𝚐𝚒𝚗𝚊𝚕',   icon: '𝕎', c1: '#0f1013', c2: '#5865f2',
      blurb: '𝚃𝚑𝚎 𝚘𝚛𝚒𝚐𝚒𝚗𝚊𝚕 𝚆.𝙸.𝚂 𝚝𝚑𝚎𝚖𝚎.' },
    { id: 'white',    name: 'PURE White', icon: '⬤', c1: '#ffffff', c2: '#000000',
      blurb: 'Eye-burning. Legally concerning.', gated: true },
    { id: 'kawaii',   name: 'Kawaii',     icon: '𖹭', c1: '#fff0f5', c2: '#ffb6c1',
      blurb: 'Dangerously cute. you are warned' },
    { id: 'discord',  name: 'Discord',    icon: '✧', c1: '#313338', c2: '#5865f2',
      blurb: 'Go touch grass' },
    { id: 'gothic',   name: 'Edgelord',   icon: '♱', c1: '#050505', c2: '#800000',
      blurb: 'Damn you are a Edgelord?' }
  ];

  var THEME_LOOKUP = {};
  THEMES.forEach(function (t) { THEME_LOOKUP[t.id] = t; });

  var root = document.documentElement;
  var currentTheme = DEFAULT_THEME;

  /* ---------------- persistence ---------------- */
  /* localStorage can throw in locked-down contexts (private tabs with
     strict settings, sandboxed iframes) — never let a storage failure
     break theming, just fall back to an in-memory choice. */
  function readStoredTheme() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return THEME_LOOKUP[v] ? v : DEFAULT_THEME;
    } catch (e) {
      return DEFAULT_THEME;
    }
  }
  function writeStoredTheme(id) {
    try { window.localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* ignore */ }
  }

  /* ---------------- witty console logs ---------------- */
  var THEME_LOG_MESSAGES = {
    original: '🌌 Back to the original. Familiar. Safe. A little boring, if we\u2019re honest.',
    white:    '⚡ Sigh, initiating flashbang... godspeed, your retinas were warned.',
    kawaii:   '🎀 Uwu-ifying the interface. Everything is now 40% more pink.',
    discord:  '🎮 Cloning Discord\u2019s dark mode, pixel for pixel. Please don\u2019t sue us.',
    gothic:   '🦇 Embracing the void. Bats sold separately.'
  };
  function logThemeChange(id) {
    var msg = THEME_LOG_MESSAGES[id];
    if (msg) console.log('%c[W.I.S. Theme] ' + msg, 'color:#8b5cf6;font-weight:600;');
  }

  /* ---------------- core apply ---------------- */
  function applyTheme(id, opts) {
    opts = opts || {};
    var theme = THEME_LOOKUP[id] || THEME_LOOKUP[DEFAULT_THEME];
    root.setAttribute('data-theme', theme.id);
    currentTheme = theme.id;
    if (opts.persist !== false) writeStoredTheme(theme.id);
    updateTriggerUI();
    updateActiveStates();
    if (typeof renderAllPresetGrids === 'function') renderAllPresetGrids();
    if (!opts.silent) logThemeChange(theme.id);
  }

  /* ---------------- trigger + popover UI ---------------- */
  var switcherRoot, triggerBtn, triggerSwatch, triggerLabel, popover;

  function buildSwitcherUI() {
    switcherRoot = document.getElementById('themeSwitcher');
    if (!switcherRoot) return; // no mount point on this page — nothing to do

    switcherRoot.classList.add('theme-switcher');

    triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.className = 'theme-trigger';
    triggerBtn.setAttribute('aria-haspopup', 'true');
    triggerBtn.setAttribute('aria-expanded', 'false');
    triggerBtn.title = 'Change theme';

    triggerSwatch = document.createElement('span');
    triggerSwatch.className = 'theme-trigger-swatch';
    triggerSwatch.setAttribute('aria-hidden', 'true');

    triggerLabel = document.createElement('span');
    triggerLabel.className = 'theme-trigger-label';

    triggerBtn.appendChild(triggerSwatch);
    triggerBtn.appendChild(triggerLabel);

    popover = document.createElement('div');
    popover.className = 'theme-popover';
    popover.setAttribute('role', 'menu');
    popover.hidden = true;

    THEMES.forEach(function (theme) {
      var opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'theme-option';
      opt.setAttribute('role', 'menuitemradio');
      opt.dataset.themeId = theme.id;

      var sw = document.createElement('span');
      sw.className = 'theme-option-swatch';
      sw.style.background = 'linear-gradient(135deg,' + theme.c1 + ' 50%,' + theme.c2 + ' 50%)';

      var text = document.createElement('span');
      text.className = 'theme-option-text';

      var title = document.createElement('span');
      title.className = 'theme-option-name';
      title.textContent = theme.icon + ' ' + theme.name;

      var blurb = document.createElement('span');
      blurb.className = 'theme-option-blurb';
      blurb.textContent = theme.blurb;

      text.appendChild(title);
      text.appendChild(blurb);
      opt.appendChild(sw);
      opt.appendChild(text);

      opt.addEventListener('click', function () {
        if (theme.gated) {
          // White Mode never applies on click alone — it has to clear
          // the waiver first. See openGatekeeperModal().
          openGatekeeperModal(theme);
        } else {
          applyTheme(theme.id);
          closePopover();
        }
      });

      popover.appendChild(opt);
    });

    switcherRoot.appendChild(triggerBtn);
    switcherRoot.appendChild(popover);

    triggerBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (popover.hidden) openPopover(); else closePopover();
    });

    document.addEventListener('mousedown', function (e) {
      if (!popover.hidden && !switcherRoot.contains(e.target)) closePopover();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !popover.hidden) {
        closePopover();
        triggerBtn.focus();
      }
    });
  }

  function openPopover() {
    popover.hidden = false;
    triggerBtn.setAttribute('aria-expanded', 'true');
  }
  function closePopover() {
    popover.hidden = true;
    triggerBtn.setAttribute('aria-expanded', 'false');
  }

  function updateTriggerUI() {
    if (!triggerBtn) return;
    var theme = THEME_LOOKUP[currentTheme] || THEME_LOOKUP[DEFAULT_THEME];
    triggerSwatch.style.background = 'linear-gradient(135deg,' + theme.c1 + ' 50%,' + theme.c2 + ' 50%)';
    triggerLabel.textContent = theme.name;
  }

  function updateActiveStates() {
    if (!popover) return;
    var opts = popover.querySelectorAll('.theme-option');
    for (var i = 0; i < opts.length; i++) {
      var isActive = opts[i].dataset.themeId === currentTheme;
      opts[i].classList.toggle('is-active', isActive);
      opts[i].setAttribute('aria-checked', String(isActive));
    }
  }

  /* ══════════════════════════════════════════════════════════════
     White Mode gatekeeper — the whole point of this exercise.
     Clicking "PURE White" never applies the theme directly. It opens
     this modal instead, and only the explicit "I AGREE" button calls
     applyTheme('white'). Cancelling — button, backdrop click, or
     Escape — is a full no-op: since the theme was never changed in
     the first place, "rolling back" just means nothing happens, and
     nothing gets written to localStorage.
     ══════════════════════════════════════════════════════════════ */

  var modalRoot = null;
  var restoreFocusEl = null;

  function buildModal() {
    if (modalRoot) return modalRoot;

    modalRoot = document.createElement('div');
    modalRoot.className = 'theme-modal-backdrop';
    modalRoot.hidden = true;

    var card = document.createElement('div');
    card.className = 'theme-modal';
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'themeModalTitle');
    card.setAttribute('aria-describedby', 'themeModalBody');

    card.innerHTML =
      '<div class="theme-modal-title" id="themeModalTitle">' +
        '\u26A0\uFE0F WARNING: RETINAL DAMAGE LIABILITY WAIVER \u26A0\uFE0F' +
      '</div>' +
      '<div class="theme-modal-body" id="themeModalBody">' +
        '<p>By switching to White Mode, you agree to the following terms:</p>' +
        '<ol>' +
          '<li>You agree that the developers are not financially or legally liable for permanent retinal scarring, flash-blindness, or sudden monitor-induced sunburns.</li>' +
          '<li>You acknowledge that you are voluntarily throwing away your dark-mode street credibility.</li>' +
          '<li>You accept that your room will now be illuminated with the raw power of a dying star.</li>' +
        '</ol>' +
      '</div>' +
      '<div class="theme-modal-actions">' +
        '<button type="button" class="theme-modal-btn theme-modal-btn--cancel" data-action="cancel">Save my eyes (Cancel)</button>' +
        '<button type="button" class="theme-modal-btn theme-modal-btn--confirm" data-action="confirm">I AGREE TO BLIND MYSELF</button>' +
      '</div>';

    modalRoot.appendChild(card);
    document.body.appendChild(modalRoot);

    modalRoot.addEventListener('mousedown', function (e) {
      if (e.target === modalRoot) cancelGatekeeper();
    });
    card.querySelector('[data-action="cancel"]').addEventListener('click', cancelGatekeeper);
    card.querySelector('[data-action="confirm"]').addEventListener('click', confirmGatekeeper);

    document.addEventListener('keydown', function (e) {
      if (modalRoot.hidden) return;
      if (e.key === 'Escape') { cancelGatekeeper(); return; }
      if (e.key === 'Tab') trapFocus(e, card);
    });

    return modalRoot;
  }

  function trapFocus(e, container) {
    var focusables = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function openGatekeeperModal() {
    closePopover();
    buildModal();
    restoreFocusEl = document.activeElement;
    modalRoot.hidden = false;
    // Focus defaults to Cancel, not Confirm — blinding yourself should
    // take a deliberate reach, not a stray Enter or Space keypress.
    modalRoot.querySelector('[data-action="cancel"]').focus();
    console.log('%c[W.I.S. Theme] White Mode requested. Presenting liability waiver\u2026', 'color:#fcd34d;font-weight:600;');
  }

  function closeGatekeeperModal() {
    if (!modalRoot) return;
    modalRoot.hidden = true;
    if (restoreFocusEl && typeof restoreFocusEl.focus === 'function') restoreFocusEl.focus();
  }

  function cancelGatekeeper() {
    console.log('%c[W.I.S. Theme] Waiver declined. Rolling back \u2014 your retinas thank you.', 'color:#6ee7b7;font-weight:600;');
    // No rollback logic needed here: applyTheme('white') was never
    // called, so the previous theme was never disturbed. Cancelling
    // is simply closing the modal and changing nothing.
    closeGatekeeperModal();
  }

  function confirmGatekeeper() {
    closeGatekeeperModal();
    flashbang(function () {
      applyTheme('white'); // now, and only now, does this get persisted
    });
  }

  function flashbang(done) {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) { done(); return; }
    var flash = document.createElement('div');
    flash.className = 'theme-flashbang';
    document.body.appendChild(flash);
    flash.addEventListener('animationend', function () { flash.remove(); });
    window.setTimeout(done, 120); // swap the theme mid-flash so the reveal lands on white
  }

  /* ---------------- init ---------------- */
  function init() {
    buildSwitcherUI();

    // The inline <head> snippet already set data-theme before first
    // paint — just read it back so this script's state agrees with
    // what's on screen. Fall back to localStorage/default if for some
    // reason that snippet didn't run (e.g. this script reused on a
    // page without it).
    var existing = root.getAttribute('data-theme');
    if (existing && THEME_LOOKUP[existing]) {
      currentTheme = existing;
      updateTriggerUI();
      updateActiveStates();
    } else {
      applyTheme(readStoredTheme(), { persist: false, silent: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
