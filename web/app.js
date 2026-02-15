(function () {
  "use strict";

  // ========== DOM refs ==========
  const viewHome = document.getElementById("view-home");
  const viewPlayer = document.getElementById("view-player");

  // Home
  const greetingLabel = document.getElementById("greeting-label");
  const historySection = document.getElementById("history-section");
  const historyScroll = document.getElementById("history-scroll");
  const inputBox = document.getElementById("input-box");
  const fileInput = document.getElementById("file-input");
  const fileNameEl = document.getElementById("file-name");
  const clearFileBtn = document.getElementById("clear-file");
  const btnExtract = document.getElementById("btn-extract");
  const linkPreview = document.getElementById("link-preview");
  const linkPreviewTitle = document.getElementById("link-preview-title");
  const linkPreviewURL = document.getElementById("link-preview-url");
  const statusEl = document.getElementById("status");

  // Player
  const btnBack = document.getElementById("btn-back");
  const playerTitle = document.getElementById("player-title");
  const playerSource = document.getElementById("player-source");
  const voiceLoading = document.getElementById("voice-loading");
  const voiceLoadingText = document.getElementById("voice-loading-text");
  const previewEl = document.getElementById("preview");
  const timeCurrent = document.getElementById("time-current");
  const timeTotal = document.getElementById("time-total");
  const progressBar = document.getElementById("progress-bar");
  const btnPlayPause = document.getElementById("btn-playpause");
  const iconPlay = document.getElementById("icon-play");
  const iconPause = document.getElementById("icon-pause");
  const btnSkipBack = document.getElementById("btn-skipback");
  const btnStop = document.getElementById("btn-stop");
  const speedSlider = document.getElementById("speed-slider");
  const speedLabel = document.getElementById("speed-label");
  const voiceSelect = document.getElementById("voice-select");

  // ========== State ==========
  let currentText = "";
  let currentTitle = "";
  let currentSource = "";
  let currentItemId = null;
  let speaking = false;
  let paused = false;
  let speechStartTime = 0;
  let speechTimer = null;
  let estimatedDuration = 0;

  // Kokoro TTS
  let kokoroTTS = null;
  let kokoroLoading = false;
  let kokoroAudioCtx = null;
  let kokoroCurrentSource = null;
  let useBrowserTTS = false; // true if Kokoro completely fails

  const HISTORY_KEY = "readAloudHistory";
  const MAX_HISTORY = 10;

  // Kokoro voices
  const KOKORO_VOICES = [
    { id: "af_heart", name: "Heart", lang: "American Female" },
    { id: "af_bella", name: "Bella", lang: "American Female" },
    { id: "af_nicole", name: "Nicole", lang: "American Female" },
    { id: "af_sky", name: "Sky", lang: "American Female" },
    { id: "am_adam", name: "Adam", lang: "American Male" },
    { id: "am_michael", name: "Michael", lang: "American Male" },
    { id: "bf_emma", name: "Emma", lang: "British Female" },
    { id: "bm_george", name: "George", lang: "British Male" },
  ];

  // ========== Greeting ==========
  function updateGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) greetingLabel.textContent = "Good morning,";
    else if (hour < 17) greetingLabel.textContent = "Good afternoon,";
    else greetingLabel.textContent = "Good evening,";
  }
  updateGreeting();

  // ========== Voices ==========
  function populateVoices() {
    voiceSelect.innerHTML = "";
    KOKORO_VOICES.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name + " (" + v.lang + ")";
      voiceSelect.appendChild(opt);
    });
    // Restore saved voice
    const saved = localStorage.getItem("readAloudVoice");
    if (saved) voiceSelect.value = saved;
  }
  populateVoices();

  voiceSelect.addEventListener("change", () => {
    localStorage.setItem("readAloudVoice", voiceSelect.value);
  });

  speedSlider.addEventListener("input", () => {
    speedLabel.textContent = parseFloat(speedSlider.value).toFixed(1) + "x";
  });

  // ========== History (localStorage) ==========
  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }

  function saveHistory(items) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  }

  function addToHistory(title, source, text, type) {
    const items = getHistory();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const filtered = items.filter((it) => it.title !== title);
    filtered.unshift({ id, title, source, text, type, progress: 0, ts: Date.now() });
    saveHistory(filtered);
    return id;
  }

  function updateHistoryProgress(id, progress) {
    const items = getHistory();
    const item = items.find((it) => it.id === id);
    if (item) {
      item.progress = Math.min(100, Math.round(progress));
      saveHistory(items);
    }
  }

  function removeFromHistory(id) {
    const items = getHistory().filter((it) => it.id !== id);
    saveHistory(items);
    renderHistory();
  }

  function renderHistory() {
    const items = getHistory();
    if (items.length === 0) {
      historySection.classList.add("hidden");
      return;
    }
    historySection.classList.remove("hidden");
    historyScroll.innerHTML = "";

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "history-card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      const iconColors = { url: "url", file: "file", text: "text" };
      const iconSymbols = { url: "&#127760;", file: "&#128196;", text: "&#128221;" };
      const type = item.type || "text";

      card.innerHTML =
        '<div class="history-card-icon ' + (iconColors[type] || "text") + '">' +
          (iconSymbols[type] || "&#128221;") +
        "</div>" +
        '<div class="history-card-title">' + escapeHTML(item.title || "Untitled") + "</div>" +
        '<div class="history-card-desc">' + escapeHTML((item.source || item.text || "").slice(0, 80)) + "</div>" +
        '<div class="history-card-progress"><div class="history-card-progress-fill" style="width:' + (item.progress || 0) + '%"></div></div>' +
        '<button class="history-card-delete" title="Remove">&times;</button>';

      card.addEventListener("click", (e) => {
        if (e.target.closest(".history-card-delete")) return;
        openPlayer(item.title, item.source || "", item.text, item.id);
      });

      card.querySelector(".history-card-delete").addEventListener("click", (e) => {
        e.stopPropagation();
        removeFromHistory(item.id);
      });

      historyScroll.appendChild(card);
    });
  }
  renderHistory();

  // ========== Views ==========
  function showView(view) {
    viewHome.classList.remove("active");
    viewPlayer.classList.remove("active");
    view.classList.add("active");
  }

  function openPlayer(title, source, text, historyId) {
    currentTitle = title || "Untitled";
    currentSource = source || "";
    currentText = text;
    currentItemId = historyId || null;

    playerTitle.textContent = currentTitle;
    playerSource.textContent = currentSource;
    previewEl.textContent = text;
    previewEl.classList.remove("hidden");

    const wordCount = text.split(/\s+/).length;
    estimatedDuration = Math.ceil((wordCount / 150) * 60);
    timeTotal.textContent = formatTime(estimatedDuration);
    timeCurrent.textContent = "0:00";
    progressBar.value = 0;

    stopSpeech();
    showView(viewPlayer);
  }

  btnBack.addEventListener("click", () => {
    stopSpeech();
    renderHistory();
    showView(viewHome);
  });

  // ========== File input ==========
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      fileNameEl.textContent = file.name;
      clearFileBtn.classList.remove("hidden");
    }
  });

  clearFileBtn.addEventListener("click", () => {
    fileInput.value = "";
    fileNameEl.textContent = "";
    clearFileBtn.classList.add("hidden");
  });

  // ========== URL detection + link preview ==========
  function looksLikeURL(str) {
    return /^https?:\/\//i.test(str.trim());
  }

  let previewDebounce = null;
  inputBox.addEventListener("input", () => {
    clearTimeout(previewDebounce);
    const text = inputBox.value.trim();
    if (looksLikeURL(text)) {
      previewDebounce = setTimeout(() => {
        try {
          const u = new URL(text);
          linkPreviewTitle.textContent = u.hostname;
          linkPreviewURL.textContent = text.length > 60 ? text.slice(0, 60) + "…" : text;
          linkPreview.classList.remove("hidden");
        } catch { linkPreview.classList.add("hidden"); }
      }, 300);
    } else {
      linkPreview.classList.add("hidden");
    }
  });

  // ========== Status ==========
  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "status " + type;
    statusEl.classList.remove("hidden");
  }
  function hideStatus() { statusEl.classList.add("hidden"); }

  // ========== Extract & Listen ==========

  /**
   * Try the Go backend API first. If it fails (e.g. on GitHub Pages where
   * there is no backend), fall back to client-side extraction.
   */
  async function doExtract(file, text) {
    const isURL = !file && looksLikeURL(text);

    // --- Attempt 1: Go backend ---
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      else if (isURL) form.append("url", text);
      else form.append("text", text);

      const resp = await fetch("/api/extract", { method: "POST", body: form });
      if (resp.ok) {
        const data = await resp.json();
        if (!data.error) return data;
      }
    } catch {
      // Backend unavailable — fall through to client-side
    }

    // --- Attempt 2: Client-side extraction ---
    if (typeof ClientExtractor !== "undefined") {
      const opts = {};
      if (file) opts.file = file;
      else if (isURL) opts.url = text;
      else opts.text = text;
      return await ClientExtractor.extract(opts);
    }

    throw new Error("Extraction failed. Please try again.");
  }

  btnExtract.addEventListener("click", async () => {
    const file = fileInput.files[0];
    const text = inputBox.value.trim();

    if (!file && !text) {
      showStatus("Paste a URL or text, or choose a file.", "error");
      return;
    }

    let type = "text";
    if (file) {
      showStatus("Extracting text from " + file.name + "…", "loading");
      type = "file";
    } else if (looksLikeURL(text)) {
      showStatus("Extracting article…", "loading");
      type = "url";
    } else {
      const id = addToHistory(text.slice(0, 50) + (text.length > 50 ? "…" : ""), "", text, "text");
      openPlayer(text.slice(0, 50), "", text, id);
      return;
    }

    try {
      const data = await doExtract(file, text);
      hideStatus();

      const title = data.title || (file ? file.name : text.slice(0, 50));
      let source = "";
      if (type === "url") {
        try { source = new URL(text).hostname; } catch {}
      } else if (type === "file") {
        source = file.name;
      }

      const id = addToHistory(title, source, data.text, type);
      openPlayer(title, source, data.text, id);

      inputBox.value = "";
      fileInput.value = "";
      fileNameEl.textContent = "";
      clearFileBtn.classList.add("hidden");
      linkPreview.classList.add("hidden");
    } catch (e) {
      showStatus(e.message, "error");
    }
  });

  inputBox.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      btnExtract.click();
    }
  });

  // ========== Kokoro TTS ==========
  async function initKokoro() {
    if (kokoroTTS) return true;
    if (useBrowserTTS) return false;
    if (kokoroLoading) return false;

    kokoroLoading = true;
    voiceLoading.classList.remove("hidden");
    voiceLoadingText.textContent = "Loading AI voice model (first time only)…";

    const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

    try {
      const { KokoroTTS } = await import(
        "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm"
      );

      voiceLoadingText.textContent = "Downloading voice model…";

      // Try WebGPU first (best quality), fall back to WASM (universal)
      try {
        kokoroTTS = await KokoroTTS.from_pretrained(MODEL, {
          dtype: "q8",
          device: "webgpu",
        });
      } catch {
        voiceLoadingText.textContent = "WebGPU not available, using WASM…";
        kokoroTTS = await KokoroTTS.from_pretrained(MODEL, {
          dtype: "q8",
          device: "wasm",
        });
      }

      voiceLoading.classList.add("hidden");
      kokoroLoading = false;
      return true;
    } catch (err) {
      console.error("Kokoro TTS failed:", err);
      kokoroLoading = false;

      // Fall back to browser SpeechSynthesis
      if (typeof speechSynthesis !== "undefined") {
        useBrowserTTS = true;
        voiceLoadingText.textContent =
          "AI voice unavailable on this device. Using built-in voice.";
        populateBrowserVoices();
        setTimeout(() => voiceLoading.classList.add("hidden"), 2500);
        return false;
      }

      voiceLoadingText.textContent =
        "Could not load AI voice. Try a different browser.";
      return false;
    }
  }

  // Browser SpeechSynthesis fallback voices
  function populateBrowserVoices() {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
      speechSynthesis.addEventListener("voiceschanged", populateBrowserVoices, { once: true });
      return;
    }
    voiceSelect.innerHTML = "";
    const english = voices.filter((v) => v.lang.startsWith("en"));
    const list = english.length > 0 ? english : voices.slice(0, 10);
    list.forEach((v, i) => {
      const opt = document.createElement("option");
      opt.value = i.toString();
      opt.textContent = v.name;
      opt.dataset.voiceURI = v.voiceURI;
      voiceSelect.appendChild(opt);
    });
  }

  function splitTextForKokoro(text) {
    const paragraphs = text.split(/\n{2,}/);
    const chunks = [];
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      if (trimmed.length <= 500) {
        chunks.push(trimmed);
      } else {
        const sentences = trimmed.match(/[^.!?]+[.!?]+[\s]*/g) || [trimmed];
        let buf = "";
        for (const s of sentences) {
          if (buf.length + s.length > 500) {
            if (buf) chunks.push(buf.trim());
            buf = s;
          } else {
            buf += s;
          }
        }
        if (buf.trim()) chunks.push(buf.trim());
      }
    }
    return chunks;
  }

  async function playSpeech() {
    await initKokoro();

    if (useBrowserTTS) {
      playWithBrowserTTS();
      return;
    }

    if (!kokoroTTS) return;

    if (!kokoroAudioCtx) {
      kokoroAudioCtx = new AudioContext({ sampleRate: 24000 });
    }

    const voiceId = voiceSelect.value || "af_heart";
    const rate = parseFloat(speedSlider.value);
    const chunks = splitTextForKokoro(currentText);

    if (chunks.length === 0) return;

    speaking = true;
    paused = false;
    speechStartTime = Date.now();
    updatePlayerUI();
    startTimer();

    for (let i = 0; i < chunks.length; i++) {
      if (!speaking) break;

      try {
        const result = await kokoroTTS.generate(chunks[i], {
          voice: voiceId,
        });

        if (!speaking) break;

        const audioData = result.audio;
        const sampleRate = result.sampling_rate || 24000;
        const buffer = kokoroAudioCtx.createBuffer(1, audioData.length, sampleRate);
        buffer.getChannelData(0).set(audioData);

        await new Promise((resolve) => {
          const source = kokoroAudioCtx.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = rate;
          source.connect(kokoroAudioCtx.destination);
          kokoroCurrentSource = source;

          source.onended = () => {
            kokoroCurrentSource = null;
            resolve();
          };
          source.start();

          const checkStop = setInterval(() => {
            if (!speaking) {
              clearInterval(checkStop);
              try { source.stop(); } catch {}
              resolve();
            }
          }, 100);
        });

      } catch (err) {
        console.warn("Kokoro chunk error:", err);
        continue;
      }

      const pct = ((i + 1) / chunks.length) * 100;
      if (currentItemId) updateHistoryProgress(currentItemId, pct);
    }

    if (speaking) {
      if (currentItemId) updateHistoryProgress(currentItemId, 100);
    }
    stopSpeech();
  }

  // ========== Browser SpeechSynthesis fallback ==========
  function playWithBrowserTTS() {
    if (typeof speechSynthesis === "undefined") return;

    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentText);
    utterance.rate = parseFloat(speedSlider.value);

    // Pick voice from select
    const voices = speechSynthesis.getVoices();
    const selectedOpt = voiceSelect.selectedOptions[0];
    if (selectedOpt && selectedOpt.dataset.voiceURI) {
      const voice = voices.find((v) => v.voiceURI === selectedOpt.dataset.voiceURI);
      if (voice) utterance.voice = voice;
    }

    speaking = true;
    paused = false;
    speechStartTime = Date.now();
    updatePlayerUI();
    startTimer();

    utterance.onend = () => stopSpeech();
    utterance.onerror = () => stopSpeech();

    speechSynthesis.speak(utterance);
  }

  // ========== Playback controls ==========
  function stopSpeech() {
    if (kokoroCurrentSource) {
      try { kokoroCurrentSource.stop(); } catch {}
      kokoroCurrentSource = null;
    }
    // Also cancel browser TTS if active
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.cancel();
    }

    speaking = false;
    paused = false;
    clearInterval(speechTimer);
    speechStartTime = 0;
    progressBar.value = 0;
    timeCurrent.textContent = "0:00";
    updatePlayerUI();
    if (currentText) {
      previewEl.textContent = currentText;
    }
  }

  function startTimer() {
    clearInterval(speechTimer);
    speechTimer = setInterval(() => {
      if (!speaking) return;
      const elapsed = (Date.now() - speechStartTime) / 1000;
      const rate = parseFloat(speedSlider.value);
      const adjusted = elapsed * rate;
      timeCurrent.textContent = formatTime(Math.floor(adjusted));
      const pct = estimatedDuration > 0 ? (adjusted / estimatedDuration) * 100 : 0;
      progressBar.value = Math.min(100, pct);
      if (currentItemId) updateHistoryProgress(currentItemId, pct);
    }, 500);
  }

  function updatePlayerUI() {
    if (speaking) {
      iconPlay.classList.add("hidden");
      iconPause.classList.remove("hidden");
    } else {
      iconPlay.classList.remove("hidden");
      iconPause.classList.add("hidden");
    }
  }

  btnPlayPause.addEventListener("click", () => {
    if (speaking) stopSpeech();
    else playSpeech();
  });
  btnSkipBack.addEventListener("click", () => { stopSpeech(); playSpeech(); });
  btnStop.addEventListener("click", stopSpeech);

  // ========== Helpers ==========
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function escapeHTML(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
})();
