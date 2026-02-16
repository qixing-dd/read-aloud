package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"read-aloud/extractor"
)

type extractURLRequest struct {
	URL string `json:"url"`
}

// ExtractURL handles POST /api/extract-url.
func ExtractURL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB limit
	var req extractURLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	if req.URL == "" {
		jsonError(w, "url is required", http.StatusBadRequest)
		return
	}

	result, err := extractor.ExtractURL(req.URL)
	if err != nil {
		log.Printf("URL extraction error: %v", err)
		jsonError(w, "Failed to extract article from the URL.", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
