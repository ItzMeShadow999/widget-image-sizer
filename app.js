const REFERENCE_SIZE = 512;
const AUTO_TOP_STRIP_BASE = 17;
const AUTO_RADIUS_BASE = 36;
const AUTO_TOP_STRIP_EXPONENT =
  Math.log(54 / 17) / Math.log(Math.sqrt(1844 * 853) / REFERENCE_SIZE);
const AUTO_RADIUS_EXPONENT =
  Math.log(172 / 36) / Math.log(Math.sqrt(1844 * 853) / REFERENCE_SIZE);

const titlebarStatus = document.querySelector("#titlebarStatus");

const inputPath = document.querySelector("#inputPath");
const outputName = document.querySelector("#outputName");
const topStrip = document.querySelector("#topStrip");
const radius = document.querySelector("#radius");
const highQualityAnimated = document.querySelector("#highQualityAnimated");
const browseButton = document.querySelector("#browseButton");
const advancedToggleBtn = document.querySelector("#advancedToggleBtn");
const advancedPanel = document.querySelector("#advancedPanel");
const processButton = document.querySelector("#processButton");
const downloadButton = document.querySelector("#downloadButton");
const status = document.querySelector("#status");
const previewEmpty = document.querySelector("#previewEmpty");
const previewLoading = document.querySelector("#previewLoading");
const previewLoadingText = document.querySelector("#previewLoadingText");
const progressWrap = document.querySelector("#progressWrap");
const progressBar = document.querySelector("#progressBar");
const progressLabel = document.querySelector("#progressLabel");
const previewImage = document.querySelector("#previewImage");
const previewMeta = document.querySelector("#previewMeta");
const localFileInput = document.querySelector("#localFileInput");
const dropZone = document.querySelector("#dropZone");
const urlInput = document.querySelector("#urlInput");
const urlImportButton = document.querySelector("#urlImportButton");

let lastResult = null;
let previewBaseMeta = "";
let selectedFile = null;
let selectedInputUrl = "";
let outputUrl = "";

function clearObjectUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

function updateTitlebarStatus() {
  if (status.textContent.trim()) {
    titlebarStatus.textContent = status.textContent.trim();
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

function setStatus(message, tone = "neutral") {
  status.textContent = message;
  status.dataset.tone = tone;
  updateTitlebarStatus();
}

function setTitlebarMessage(message) {
  status.textContent = "";
  status.dataset.tone = "neutral";
  titlebarStatus.textContent = message;
}

function setPreviewLoading(loading, message = "Loading preview...") {
  previewLoading.hidden = !loading;
  previewLoadingText.textContent = loading ? message : "";
}

function setProgressState(visible, percent = 0, label = "") {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  progressWrap.hidden = !visible;
  progressBar.style.width = `${clampedPercent}%`;
  progressLabel.textContent = label || `${clampedPercent}%`;
}

function setPreviewMeta(message = "") {
  previewMeta.textContent = message;
}

function clearPreview() {
  previewImage.removeAttribute("src");
  previewImage.hidden = true;
  previewEmpty.hidden = false;
  previewBaseMeta = "";
  setPreviewMeta("");
  setPreviewLoading(false);
  setProgressState(false, 0, "");
  updateTitlebarStatus();
}

function updatePreviewMetaWithDimensions() {
  if (previewImage.hidden || !previewImage.naturalWidth || !previewImage.naturalHeight) {
    setPreviewMeta(previewBaseMeta);
    return;
  }

  const dimensions = `${previewImage.naturalWidth}x${previewImage.naturalHeight}`;
  setPreviewMeta(previewBaseMeta ? `${previewBaseMeta} ${dimensions}.` : dimensions);
}

function getSuggestedOutputName(fileName) {
  const cleanName = fileName.split(/[/\\]/).pop() ?? "image";
  const extensionMatch = cleanName.match(/\.[^.]+$/);
  const extension = extensionMatch?.[0]?.toLowerCase() ?? ".png";
  const stem = cleanName.replace(/\.[^.]+$/, "");
  return `${stem}-resized${extension}`;
}

function isGifInput(fileName) {
  return /\.gif$/i.test(fileName);
}

function isWebpInput(fileName) {
  return /\.webp$/i.test(fileName);
}

function getAutoValue(baseValue, exponent, width, height) {
  const sizeFactor = Math.sqrt(width * height) / REFERENCE_SIZE;
  return Math.max(0, Math.round(baseValue * Math.pow(sizeFactor, exponent)));
}

function parseOptionalNumber(value, label) {
  if (value == null || value === "") {
    return null;
  }

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

// Reserves the top strip and cuts a rounded corner out of the top-right,
// matching the desktop app's widget-framing effect. Shared by the still-image
// and per-GIF-frame pipelines so both stay pixel-identical.
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

async function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode image."));
    image.src = src;
  });
}

function setPreview(src, label) {
  previewImage.src = src;
  previewImage.alt = label;
  previewImage.hidden = false;
  previewEmpty.hidden = true;
}

function openFileDialog() {
  return new Promise((resolve) => {
    localFileInput.value = "";
    localFileInput.onchange = () => resolve(localFileInput.files?.[0] ?? null);
    localFileInput.click();
  });
}

function guessExtensionFromContentType(contentType) {
  const subtype = contentType.split("/")[1]?.split(/[+;]/)[0]?.toLowerCase();
  if (!subtype) return "png";
  if (subtype === "jpg" || subtype === "jpeg") return "jpg";
  if (["png", "gif", "webp"].includes(subtype)) return subtype;
  return "png";
}

function fileNameFromUrl(url, contentType) {
  let pathname = "image";
  try {
    pathname = new URL(url).pathname.split("/").pop() || "image";
  } catch {
    // fall back to the default name below
  }
  pathname = decodeURIComponent(pathname).split(/[?#]/)[0] || "image";

  if (/\.(png|jpe?g|webp|gif)$/i.test(pathname)) {
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
    throw new Error("That URL doesn't point to an image or GIF.");
  }

  const fileName = fileNameFromUrl(url.href, contentType);
  return new File([blob], fileName, { type: contentType || "image/png" });
}

async function importImageFromUrl(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    setStatus("Paste an image or GIF URL first.", "error");
    return;
  }

  urlImportButton.disabled = true;
  setStatus("", "neutral");
  setPreviewLoading(true, "Fetching image from URL...");

  try {
    const file = await fetchImageAsFile(trimmed);
    await handleSelectedFile(file);
    urlInput.value = "";
  } catch (error) {
    setPreviewLoading(false);
    setStatus(String(error?.message ?? error), "error");
  } finally {
    urlImportButton.disabled = false;
  }
}

function setSelectedFile(file) {
  selectedFile = file;
  clearObjectUrl(selectedInputUrl);
  selectedInputUrl = file ? URL.createObjectURL(file) : "";
}

function computeDimensions(width, height) {
  const manualTopStrip = parseOptionalNumber(topStrip.value, "top strip");
  const manualRadius = parseOptionalNumber(radius.value, "radius");
  const finalTopStrip =
    manualTopStrip ?? getAutoValue(AUTO_TOP_STRIP_BASE, AUTO_TOP_STRIP_EXPONENT, width, height);
  const autoRadius =
    manualRadius ?? getAutoValue(AUTO_RADIUS_BASE, AUTO_RADIUS_EXPONENT, width, height);
  const finalRadius = clampRadius(autoRadius, width, height, finalTopStrip);
  return { finalTopStrip, finalRadius, autoCalculated: manualTopStrip == null && manualRadius == null };
}

function sizeWarning(width, height) {
  return width !== REFERENCE_SIZE || height !== REFERENCE_SIZE
    ? `Widget may look odd if the original image size is not ${REFERENCE_SIZE}x${REFERENCE_SIZE}. Detected ${width}x${height}.`
    : null;
}

async function processStillImage(file) {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(sourceUrl);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const { finalTopStrip, finalRadius, autoCalculated } = computeDimensions(width, height);

    setProgressState(true, 30, "Preparing image (30%)");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is not available in this browser.");
    }

    applyWidgetEffect(context, width, height, finalTopStrip, finalRadius, image);

    setProgressState(true, 80, "Encoding image (80%)");

    const desiredName = outputName.value.trim() || getSuggestedOutputName(file.name);
    const extension = (desiredName.match(/\.[^.]+$/)?.[0] ?? ".png").toLowerCase();
    const mimeType =
      extension === ".jpg" || extension === ".jpeg"
        ? "image/jpeg"
        : extension === ".webp"
          ? "image/webp"
          : "image/png";

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Could not encode the generated image."));
        }
      }, mimeType, mimeType === "image/jpeg" ? 0.92 : undefined);
    });

    clearObjectUrl(outputUrl);
    outputUrl = URL.createObjectURL(blob);
    setProgressState(true, 100, "Done (100%)");

    return {
      outputName: desiredName,
      previewUrl: outputUrl,
      width,
      height,
      topStrip: finalTopStrip,
      radius: finalRadius,
      autoCalculated,
      frameCount: 1,
      animated: false,
      warning: [
        sizeWarning(width, height),
        isWebpInput(file.name) ? "Exported as a single still WEBP frame." : null
      ].filter(Boolean).join(" ") || null
    };
  } finally {
    clearObjectUrl(sourceUrl);
  }
}

// modern-gif ships in a few different module shapes depending on version, and
// plain <script src> tags are unreliable across CDNs when a package's "bare
// URL" resolves to an ESM build (the export statement just fails silently in
// a classic script). Importing it as a real ES module side-steps that, with a
// second CDN as a fallback in case the first is unreachable.
let modernGifPromise = null;

async function loadModernGif() {
  if (modernGifPromise) {
    return modernGifPromise;
  }

  modernGifPromise = (async () => {
    const sources = [
      "https://esm.sh/modern-gif@2",
      "https://cdn.jsdelivr.net/npm/modern-gif@2/+esm"
    ];

    let lastError = null;
    for (const source of sources) {
      try {
        const module = await import(/* @vite-ignore */ source);
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

async function processGif(file) {
  let modernGif;
  try {
    modernGif = await loadModernGif();
  } catch (error) {
    throw new Error(
      `GIF engine failed to load (${error?.message ?? error}). Check your connection and reload the page.`
    );
  }

  setProgressState(true, 5, "Reading GIF (5%)");
  const buffer = await file.arrayBuffer();
  const gifInfo = modernGif.decode(buffer);
  const width = gifInfo.width;
  const height = gifInfo.height;
  const { finalTopStrip, finalRadius, autoCalculated } = computeDimensions(width, height);

  setProgressState(true, 15, "Decoding frames (15%)");
  const decodedFrames = await modernGif.decodeFrames(buffer);
  const totalFrames = decodedFrames.length || 1;

  const outputFrames = decodedFrames.map((frame, index) => {
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = frame.width;
    frameCanvas.height = frame.height;
    frameCanvas
      .getContext("2d")
      .putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = width;
    outputCanvas.height = height;
    applyWidgetEffect(outputCanvas.getContext("2d"), width, height, finalTopStrip, finalRadius, frameCanvas);

    const percent = 15 + Math.round(((index + 1) / totalFrames) * 65);
    setProgressState(true, percent, `Preparing frames ${index + 1}/${totalFrames} (${percent}%)`);

    return { data: outputCanvas, delay: frame.delay ?? 100 };
  });

  setProgressState(true, 85, "Encoding GIF (85%)");
  const output = await modernGif.encode({
    width,
    height,
    frames: outputFrames,
    maxColors: highQualityAnimated.checked ? 255 : 128,
    loop: 0
  });

  clearObjectUrl(outputUrl);
  const blob = new Blob([output], { type: "image/gif" });
  outputUrl = URL.createObjectURL(blob);
  setProgressState(true, 100, `Encoding frames ${totalFrames}/${totalFrames} (100%)`);

  const desiredName = outputName.value.trim() || getSuggestedOutputName(file.name);

  return {
    outputName: desiredName,
    previewUrl: outputUrl,
    width,
    height,
    topStrip: finalTopStrip,
    radius: finalRadius,
    autoCalculated,
    frameCount: totalFrames,
    animated: true,
    warning: sizeWarning(width, height)
  };
}

function resetResultState() {
  lastResult = null;
  downloadButton.disabled = true;
}

previewImage.addEventListener("load", () => {
  setPreviewLoading(false);
  updatePreviewMetaWithDimensions();
});

previewImage.addEventListener("error", () => {
  setPreviewLoading(false);
  setPreviewMeta(previewBaseMeta || "Preview unavailable.");
});

outputName.addEventListener("input", () => {
  updateTitlebarStatus();
});

async function handleSelectedFile(file) {
  if (!file) {
    return;
  }

  setSelectedFile(file);
  inputPath.value = file.name;
  outputName.value = getSuggestedOutputName(file.name);
  resetResultState();

  previewBaseMeta = isWebpInput(file.name)
    ? "Previewing selected image. WEBP exports as a still frame."
    : "Previewing selected image.";

  updateTitlebarStatus();
  setPreviewLoading(true, "");

  try {
    setPreview(selectedInputUrl, "Selected input image");
    setPreviewMeta(previewBaseMeta);
    setStatus("", "neutral");
  } catch (error) {
    setPreviewLoading(false);
    setStatus(`Could not preview image: ${String(error)}`, "error");
  }
}

browseButton.addEventListener("click", async () => {
  const selected = await openFileDialog();
  await handleSelectedFile(selected);
});

urlImportButton.addEventListener("click", async () => {
  await importImageFromUrl(urlInput.value);
});

urlInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    await importImageFromUrl(urlInput.value);
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
    await handleSelectedFile(file);
    return;
  }

  // Dragging an <img> from a webpage (or another tab) carries no File —
  // just a URL as text, under one of these MIME types depending on the browser.
  const draggedUrl =
    event.dataTransfer?.getData("text/uri-list") ||
    event.dataTransfer?.getData("text/plain") ||
    "";

  const firstUrl = draggedUrl
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

  if (firstUrl) {
    await importImageFromUrl(firstUrl);
  }
});

advancedToggleBtn.addEventListener("click", () => {
  const isOpen = advancedPanel.classList.toggle("advanced-panel--open");
  advancedToggleBtn.setAttribute("aria-pressed", String(isOpen));
});

processButton.addEventListener("click", async () => {
  if (!selectedFile) {
    setStatus("Choose an input image first.", "error");
    return;
  }

  processButton.disabled = true;
  downloadButton.disabled = true;
  setProgressState(false, 0, "");
  setStatus("", "neutral");
  setPreviewLoading(true, "");

  try {
    const result = isGifInput(selectedFile.name)
      ? await processGif(selectedFile)
      : await processStillImage(selectedFile);

    lastResult = result;
    downloadButton.disabled = false;

    previewBaseMeta = result.animated
      ? `Previewing output, ${result.frameCount} frames.`
      : "Previewing generated output.";
    setPreview(result.previewUrl, "Processed output image");
    setPreviewMeta(previewBaseMeta);

    if (result.warning) {
      setTitlebarMessage(result.warning);
    } else {
      setStatus("", "success");
    }
  } catch (error) {
    setPreviewLoading(false);
    setProgressState(false, 0, "");
    setStatus(String(error?.message ?? error), "error");
  } finally {
    processButton.disabled = false;
  }
});

downloadButton.addEventListener("click", () => {
  if (!lastResult) {
    setStatus("Generate an image before downloading it.", "error");
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

clearPreview();
setStatus("", "neutral");
