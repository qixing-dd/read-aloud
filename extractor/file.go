package extractor

import (
	"fmt"
	"io"
	"path/filepath"
	"strings"
)

// SupportedFileExts lists the file extensions the extractor can handle.
var SupportedFileExts = []string{".txt", ".md", ".pdf", ".docx", ".doc"}

// ExtractFile reads an uploaded file and returns the plain text.
// It dispatches to the correct extractor based on the file extension.
func ExtractFile(filename string, r io.Reader) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))

	switch ext {
	case ".txt", ".md":
		return extractPlainText(r)
	case ".pdf":
		return ExtractPDF(r)
	case ".docx":
		return ExtractDOCX(r)
	case ".doc":
		return "", fmt.Errorf(
			".doc (legacy Word) is not supported — please save as .docx and try again")
	default:
		return "", fmt.Errorf(
			"unsupported file type %q — supported: %s",
			ext, strings.Join(SupportedFileExts, ", "))
	}
}

// extractPlainText reads the entire content as UTF-8 text.
func extractPlainText(r io.Reader) (string, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return "", fmt.Errorf("read file: %w", err)
	}
	return strings.TrimSpace(string(data)), nil
}
