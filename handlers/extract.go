package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"read-aloud/extractor"
)

// extractResponse is the JSON shape returned by /api/extract.
type extractResponse struct {
	Title string `json:"title,omitempty"`
	Text  string `json:"text"`
}

// Extract handles POST /api/extract.
//
// The request is multipart/form-data with optional fields:
//   - "url"  — a URL to fetch and extract an article from.
//   - "text" — plain text to read aloud directly.
//   - "file" — an uploaded file (.txt, .md, .pdf, .docx).
//
// Priority: file > url > text (if multiple are sent).
func Extract(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart (32 MB max) — also works for plain form fields.
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// --- 1. File upload takes priority ---
	file, header, err := r.FormFile("file")
	if err == nil && header != nil {
		defer file.Close()
		text, err := extractor.ExtractFile(header.Filename, file)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, extractResponse{
			Title: header.Filename,
			Text:  text,
		})
		return
	}

	// --- 2. URL ---
	rawURL := strings.TrimSpace(r.FormValue("url"))
	if rawURL != "" {
		result, err := extractor.ExtractURL(rawURL)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, extractResponse{
			Title: result.Title,
			Text:  result.Text,
		})
		return
	}

	// --- 3. Plain text ---
	text := strings.TrimSpace(r.FormValue("text"))
	if text != "" {
		jsonOK(w, extractResponse{Text: text})
		return
	}

	jsonError(w, "provide a URL, paste text, or upload a file", http.StatusBadRequest)
}

func jsonOK(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
