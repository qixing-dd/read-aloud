# Read Aloud

Paste a URL, type text, or upload a file — and listen to it read aloud with a natural AI voice.

## Use it online (phone or desktop)

Visit the web version — no download needed:

**https://YOUR_USERNAME.github.io/read-aloud/**

Works on any device: iPhone, Android, Mac, Windows, Linux.

## Download and run locally

For the best experience on a computer, download the app:

1. Go to [Releases](../../releases/latest)
2. Download the zip for your computer:
   - **Mac (Apple Silicon / M1+):** `read-aloud-macos-arm64.zip`
   - **Mac (Intel):** `read-aloud-macos-amd64.zip`
   - **Windows:** `read-aloud-windows-amd64.zip`
   - **Linux:** `read-aloud-linux-amd64.zip`
3. Unzip and run the `read-aloud` file
4. Chrome opens automatically with the app

### First time on Mac

macOS may block the app because it's from the internet:

1. Right-click the `read-aloud` file
2. Click **Open**
3. Click **Open** again in the dialog

After the first time, you can just double-click it.

### Desktop shortcut

The first time you run the app, it creates a shortcut on your Desktop called **"Read Aloud"**. Next time, just double-click that shortcut.

## What it does

- **URLs** — pastes a link and extracts the article text (works with news sites, blogs, X/Twitter posts, and more)
- **Text** — type or paste any text directly
- **Files** — upload `.pdf`, `.docx`, `.txt`, or `.md` files

Then listen with a natural AI voice powered by [Kokoro TTS](https://github.com/nicktomlin/kokoro-js).

## Features

- Natural AI voice (Kokoro TTS) with multiple voice options
- Speed control (0.5x to 2.0x)
- Continue Listening — pick up where you left off
- Works offline after the first voice model download
- Phone-friendly — use it on the same Wi-Fi network or via the web version

## Phone access over Wi-Fi

When running the app locally, your phone can connect to it if both devices are on the same Wi-Fi network. The app prints the local network URL when it starts:

```
Listening on http://localhost:8080
Also available at http://192.168.1.42:8080
```

Open that second URL on your phone's browser.

## Build from source

Requires [Go 1.21+](https://go.dev/dl/).

```bash
cd projects/vibeProjects/read-aloud
go build -o read-aloud .
./read-aloud
```

## License

MIT
