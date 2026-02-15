package extractor

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/ledongthuc/pdf"
)

// ExtractPDF reads a PDF from an io.Reader and returns the plain text.
// The ledongthuc/pdf library requires a file on disk, so we write to a temp file.
func ExtractPDF(r io.Reader) (string, error) {
	tmp, err := os.CreateTemp("", "read-aloud-*.pdf")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()

	if _, err := io.Copy(tmp, r); err != nil {
		return "", fmt.Errorf("write temp file: %w", err)
	}
	tmp.Close()

	f, reader, err := pdf.Open(tmp.Name())
	if err != nil {
		return "", fmt.Errorf("open PDF: %w", err)
	}
	defer f.Close()

	plainText, err := reader.GetPlainText()
	if err != nil {
		return "", fmt.Errorf("extract text: %w", err)
	}

	var buf bytes.Buffer
	buf.ReadFrom(plainText)

	return strings.TrimSpace(buf.String()), nil
}
