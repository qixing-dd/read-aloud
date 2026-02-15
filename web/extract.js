/**
 * Client-side extraction module.
 * Used when the Go backend is unavailable (e.g. GitHub Pages deployment).
 *
 * - URL extraction: CORS proxy + Readability.js
 * - PDF extraction: pdf.js (Mozilla)
 * - DOCX extraction: mammoth.js
 */

const ClientExtractor = (function () {
  "use strict";

  // CDN URLs for libraries (loaded on demand)
  const READABILITY_CDN =
    "https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.min.js";
  const PDFJS_CDN =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs";
  const PDFJS_WORKER_CDN =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs";
  const MAMMOTH_CDN =
    "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js";

  // CORS proxies (try in order)
  const CORS_PROXIES = [
    (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
    (url) => "https://corsproxy.io/?" + encodeURIComponent(url),
  ];

  // --- Helpers ---

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  async function loadModule(src) {
    return await import(src);
  }

  // --- URL extraction ---

  async function extractURL(url) {
    // Load Readability if not present
    if (typeof Readability === "undefined") {
      await loadScript(READABILITY_CDN);
    }

    // Fetch via CORS proxy
    let html = null;
    for (const proxyFn of CORS_PROXIES) {
      try {
        const proxyURL = proxyFn(url);
        const resp = await fetch(proxyURL);
        if (resp.ok) {
          html = await resp.text();
          break;
        }
      } catch {
        continue;
      }
    }

    if (!html) {
      throw new Error(
        "Could not fetch the URL. The site may block external access."
      );
    }

    // Parse with Readability
    const doc = new DOMParser().parseFromString(html, "text/html");
    // Fix relative URLs
    const base = doc.createElement("base");
    base.href = url;
    doc.head.appendChild(base);

    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article || !article.textContent || article.textContent.trim().length < 50) {
      throw new Error("Could not extract readable content from this URL.");
    }

    return {
      title: article.title || "",
      text: article.textContent.trim(),
    };
  }

  // --- PDF extraction ---

  let pdfjsLib = null;

  async function extractPDF(file) {
    if (!pdfjsLib) {
      pdfjsLib = await loadModule(PDFJS_CDN);
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      if (pageText.trim()) textParts.push(pageText.trim());
    }

    if (textParts.length === 0) {
      throw new Error("Could not extract text from this PDF.");
    }

    return {
      title: file.name.replace(/\.pdf$/i, ""),
      text: textParts.join("\n\n"),
    };
  }

  // --- DOCX extraction ---

  async function extractDOCX(file) {
    if (typeof mammoth === "undefined") {
      await loadScript(MAMMOTH_CDN);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    if (!result.value || result.value.trim().length === 0) {
      throw new Error("Could not extract text from this DOCX file.");
    }

    return {
      title: file.name.replace(/\.docx?$/i, ""),
      text: result.value.trim(),
    };
  }

  // --- TXT / MD extraction ---

  async function extractTextFile(file) {
    const text = await file.text();
    return {
      title: file.name.replace(/\.(txt|md)$/i, ""),
      text: text.trim(),
    };
  }

  // --- Unified extraction ---

  async function extractFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    switch (ext) {
      case "pdf":
        return extractPDF(file);
      case "docx":
        return extractDOCX(file);
      case "doc":
        throw new Error(
          ".doc files are not supported. Please convert to .docx, .pdf, or .txt."
        );
      case "txt":
      case "md":
        return extractTextFile(file);
      default:
        throw new Error("Unsupported file type: ." + ext);
    }
  }

  /**
   * Main extraction entry point.
   * @param {Object} opts - { url?: string, file?: File, text?: string }
   * @returns {Promise<{title: string, text: string}>}
   */
  async function extract(opts) {
    if (opts.file) {
      return extractFile(opts.file);
    }
    if (opts.url) {
      return extractURL(opts.url);
    }
    if (opts.text) {
      return {
        title: opts.text.slice(0, 50) + (opts.text.length > 50 ? "…" : ""),
        text: opts.text,
      };
    }
    throw new Error("Nothing to extract.");
  }

  return { extract };
})();
