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
  let speechStartTime = 0;
  let speechTimer = null;
  let estimatedDuration = 0;

  const HISTORY_KEY = "readAloudHistory";
  const MAX_HISTORY = 10;

  // ========== Greeting ==========
  function updateGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) greetingLabel.textContent = "Good morning,";
    else if (hour < 17) greetingLabel.textContent = "Good afternoon,";
    else greetingLabel.textContent = "Good evening,";
  }
  updateGreeting();

  // ========== Voices (Browser SpeechSynthesis) ==========
  function populateVoices() {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
      // Voices not loaded yet — wait for the event
      speechSynthesis.addEventListener("voiceschanged", populateVoices, { once: true });
      return;
    }
    voiceSelect.innerHTML = "";
    const english = voices.filter((v) => v.lang.startsWith("en"));
    const list = english.length > 0 ? english : voices.slice(0, 10);
    list.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = v.name;
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

  function containsURL(str) {
    return /https?:\/\/[^\s"<>)]+/i.test(str);
  }

  function countURLs(str) {
    const matches = str.match(/https?:\/\/[^\s"<>)]+/gi);
    return matches ? matches.length : 0;
  }

  let previewDebounce = null;
  inputBox.addEventListener("input", () => {
    clearTimeout(previewDebounce);
    const text = inputBox.value.trim();
    if (looksLikeURL(text)) {
      previewDebounce = setTimeout(() => {
        try {
          const u = new URL(text);
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            linkPreview.classList.add("hidden");
            return;
          }
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
  function showStatus(msg, type, dismissable) {
    statusEl.className = "status " + type;
    statusEl.classList.remove("hidden");
    if (dismissable) {
      statusEl.innerHTML = '<span class="status-msg">' + escapeHTML(msg) + '</span>' +
        '<button class="status-dismiss" title="Dismiss">&times;</button>';
      statusEl.querySelector(".status-dismiss").addEventListener("click", hideStatus);
    } else {
      statusEl.textContent = msg;
    }
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
      const data = await resp.json();

      if (resp.ok && !data.error) return data;

      // Backend returned an intentional error — surface it, don't fall through.
      if (data.error) throw new Error(data.error);
    } catch (e) {
      // Re-throw backend errors; only fall through on network/fetch failures.
      if (e instanceof Error && e.message && !e.message.includes("fetch")) throw e;
    }

    // --- Attempt 2: Client-side extraction (backend unavailable) ---
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
    } else if (containsURL(text)) {
      if (countURLs(text) > 1) {
        showStatus("We found more than one link. Please paste one URL per submission so we can extract the right article.", "error", true);
        return;
      }
      showStatus("Extracting content from link…", "loading");
      type = "text_with_url";
    } else {
      const id = addToHistory(text.slice(0, 50) + (text.length > 50 ? "…" : ""), "", text, "text");
      openPlayer(text.slice(0, 50), "", text, id);
      return;
    }

    try {
      const data = await doExtract(file, text);
      hideStatus();

      if (data.warning) {
        showStatus(data.warning, "error", true);
      }

      const title = data.title || (file ? file.name : text.slice(0, 50));
      let source = "";
      let histType = type;
      if (type === "url") {
        try { source = new URL(text).hostname; } catch {}
      } else if (type === "file") {
        source = file.name;
      } else if (type === "text_with_url") {
        const urlMatch = text.match(/https?:\/\/[^\s"<>)]+/i);
        if (urlMatch) {
          try { source = new URL(urlMatch[0]).hostname; } catch {}
        }
        histType = data.warning ? "text" : "url";
      }

      const id = addToHistory(title, source, data.text, histType);
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

  // ========== Speech Playback ==========
  function playSpeech() {
    if (typeof speechSynthesis === "undefined") return;

    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentText);
    utterance.rate = parseFloat(speedSlider.value);

    // Pick selected voice
    const voices = speechSynthesis.getVoices();
    const selectedURI = voiceSelect.value;
    if (selectedURI) {
      const voice = voices.find((v) => v.voiceURI === selectedURI);
      if (voice) utterance.voice = voice;
    }

    speaking = true;
    speechStartTime = Date.now();
    updatePlayerUI();
    startTimer();

    utterance.onend = () => stopSpeech();
    utterance.onerror = () => stopSpeech();

    speechSynthesis.speak(utterance);
  }

  // ========== Playback controls ==========
  function stopSpeech() {
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.cancel();
    }

    speaking = false;
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
