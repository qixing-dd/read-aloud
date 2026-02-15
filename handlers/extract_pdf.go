package handlers

import (
	"encoding/json"
	"net/http"

	"read-aloud/extractor"
)

// ExtractPDF handles POST /api/extract-pdf (multipart file upload).
func ExtractPDF(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 32 MB max
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		jsonError(w, "invalid multipart form", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "file field is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	text, err := extractor.ExtractPDF(file)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"text": text})
}
