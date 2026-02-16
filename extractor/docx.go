package extractor

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"strings"
)

// ExtractDOCX reads a .docx file from an io.Reader and returns plain text.
// A .docx file is a ZIP archive containing word/document.xml with the text.
func ExtractDOCX(r io.Reader) (string, error) {
	// Write to temp file since zip.NewReader needs a ReaderAt.
	tmp, err := os.CreateTemp("", "read-aloud-*.docx")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()

	size, err := io.Copy(tmp, r)
	if err != nil {
		return "", fmt.Errorf("write temp file: %w", err)
	}
	tmp.Close()

	f, err := os.Open(tmp.Name())
	if err != nil {
		return "", fmt.Errorf("open temp file: %w", err)
	}
	defer f.Close()

	zr, err := zip.NewReader(f, size)
	if err != nil {
		return "", fmt.Errorf("open zip: %w", err)
	}

	// Find word/document.xml in the archive.
	var docFile *zip.File
	for _, zf := range zr.File {
		if zf.Name == "word/document.xml" {
			docFile = zf
			break
		}
	}
	if docFile == nil {
		return "", fmt.Errorf("word/document.xml not found in docx")
	}

	// Guard against zip bombs: reject if uncompressed size exceeds 50 MB.
	const maxDecompressed = 50 << 20
	if docFile.UncompressedSize64 > maxDecompressed {
		return "", fmt.Errorf("document.xml too large (%d bytes)", docFile.UncompressedSize64)
	}

	rc, err := docFile.Open()
	if err != nil {
		return "", fmt.Errorf("open document.xml: %w", err)
	}
	defer rc.Close()

	return parseDocumentXML(io.LimitReader(rc, maxDecompressed))
}

// parseDocumentXML extracts plain text from Word's document.xml.
// Text lives in <w:t> elements; paragraphs are <w:p> elements.
func parseDocumentXML(r io.Reader) (string, error) {
	decoder := xml.NewDecoder(r)
	var paragraphs []string
	var currentParagraph strings.Builder
	inText := false

	for {
		tok, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("parse xml: %w", err)
		}

		switch t := tok.(type) {
		case xml.StartElement:
			localName := t.Name.Local
			if localName == "t" {
				inText = true
			}
			// <w:br/> and <w:cr/> are line breaks within a paragraph.
			if localName == "br" || localName == "cr" {
				currentParagraph.WriteString("\n")
			}
			// <w:tab/> is a tab.
			if localName == "tab" {
				currentParagraph.WriteString("\t")
			}
		case xml.EndElement:
			localName := t.Name.Local
			if localName == "t" {
				inText = false
			}
			// End of a paragraph — flush the buffer.
			if localName == "p" {
				text := strings.TrimRight(currentParagraph.String(), " \t")
				paragraphs = append(paragraphs, text)
				currentParagraph.Reset()
			}
		case xml.CharData:
			if inText {
				currentParagraph.Write(t)
			}
		}
	}

	// Flush any remaining text.
	if currentParagraph.Len() > 0 {
		paragraphs = append(paragraphs, currentParagraph.String())
	}

	return strings.TrimSpace(strings.Join(paragraphs, "\n")), nil
}
