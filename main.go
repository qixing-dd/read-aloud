package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"read-aloud/handlers"
)

//go:embed web/*
var webFS embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	webContent, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(webContent)))
	mux.HandleFunc("/api/extract", handlers.Extract)
	// Keep legacy endpoints for backwards compatibility.
	mux.HandleFunc("/api/extract-url", handlers.ExtractURL)
	mux.HandleFunc("/api/extract-pdf", handlers.ExtractPDF)

	addr := ":" + port
	localURL := "http://localhost:" + port

	// Start server in background so we can open the browser
	go func() {
		fmt.Printf("Listening on %s\n", localURL)
		if lanIP := getLANIP(); lanIP != "" {
			fmt.Printf("Also available at http://%s:%s\n", lanIP, port)
		}
		log.Fatal(http.ListenAndServe(addr, mux))
	}()

	// Give the server a moment to start, then open Chrome
	time.Sleep(500 * time.Millisecond)
	openInChrome(localURL)

	// Create desktop shortcut on first run
	createDesktopShortcut()

	select {} // Keep running
}

// getLANIP returns the first non-loopback IPv4 address, or "".
func getLANIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, a := range addrs {
		ipnet, ok := a.(*net.IPNet)
		if !ok || ipnet.IP.IsLoopback() {
			continue
		}
		if ip4 := ipnet.IP.To4(); ip4 != nil {
			return ip4.String()
		}
	}
	return ""
}

// openInChrome opens url in Google Chrome (macOS). On other OSes
// it uses the default browser.
func openInChrome(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", "-a", "Google Chrome", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "chrome", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		// Fallback: try default browser on macOS
		if runtime.GOOS == "darwin" {
			_ = exec.Command("open", url).Start()
		}
	}
}

// createDesktopShortcut places a shortcut on the user's Desktop that
// launches the app and opens the browser. It only runs once; if the
// shortcut already exists it does nothing.
func createDesktopShortcut() {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	desktop := filepath.Join(home, "Desktop")

	// Resolve path to this binary
	exe, err := os.Executable()
	if err != nil {
		return
	}
	exe, _ = filepath.EvalSymlinks(exe)

	switch runtime.GOOS {
	case "darwin":
		shortcut := filepath.Join(desktop, "Read Aloud.command")
		if fileExists(shortcut) {
			return
		}
		content := fmt.Sprintf("#!/bin/bash\n"+
			"# Read Aloud — listen to articles with AI voice\n"+
			"cd \"%s\"\n"+
			"exec \"%s\"\n",
			filepath.Dir(exe), exe)
		if err := os.WriteFile(shortcut, []byte(content), 0755); err != nil {
			return
		}
		fmt.Println("Desktop shortcut created: Read Aloud.command")

	case "windows":
		shortcut := filepath.Join(desktop, "Read Aloud.bat")
		if fileExists(shortcut) {
			return
		}
		content := fmt.Sprintf("@echo off\r\n"+
			"start \"\" \"%s\"\r\n", exe)
		if err := os.WriteFile(shortcut, []byte(content), 0644); err != nil {
			return
		}
		fmt.Println("Desktop shortcut created: Read Aloud.bat")

	case "linux":
		shortcut := filepath.Join(desktop, "read-aloud.desktop")
		if fileExists(shortcut) {
			return
		}
		content := fmt.Sprintf("[Desktop Entry]\n"+
			"Name=Read Aloud\n"+
			"Exec=%s\n"+
			"Type=Application\n"+
			"Terminal=false\n"+
			"Comment=Listen to articles with AI voice\n",
			exe)
		if err := os.WriteFile(shortcut, []byte(content), 0755); err != nil {
			return
		}
		fmt.Println("Desktop shortcut created: read-aloud.desktop")
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
