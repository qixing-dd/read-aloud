package extractor

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	readability "github.com/go-shiori/go-readability"
)

// URLResult holds extracted article data.
type URLResult struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

// tweetURLPattern matches X.com and Twitter.com tweet URLs and captures
// the username (group 1) and status ID (group 2).
var tweetURLPattern = regexp.MustCompile(
	`^https?://(www\.)?(twitter\.com|x\.com)/(\w+)/status/(\d+)`,
)

// ExtractURL fetches the given URL and extracts readable text content.
// For X/Twitter links it uses the fxtwitter API since tweets and
// X Articles require JavaScript and cannot be fetched directly.
func ExtractURL(rawURL string) (*URLResult, error) {
	if m := tweetURLPattern.FindStringSubmatch(rawURL); m != nil {
		username := m[3]
		statusID := m[4]
		return extractTweet(username, statusID)
	}

	article, err := readability.FromURL(rawURL, 30*time.Second)
	if err != nil {
		return nil, fmt.Errorf("extraction failed: %w", err)
	}

	return &URLResult{
		Title: article.Title,
		Text:  strings.TrimSpace(article.TextContent),
	}, nil
}

// fxTweetResponse maps the fxtwitter API response.
type fxTweetResponse struct {
	Tweet struct {
		Text   string `json:"text"`
		Author struct {
			Name       string `json:"name"`
			ScreenName string `json:"screen_name"`
		} `json:"author"`
		Article *fxArticle `json:"article"`
	} `json:"tweet"`
}

// fxArticle maps the article field in an fxtwitter response.
type fxArticle struct {
	Title   string `json:"title"`
	Content struct {
		Blocks []struct {
			Text string `json:"text"`
		} `json:"blocks"`
	} `json:"content"`
}

// extractTweet uses the fxtwitter API to get tweet and article content.
// If the tweet contains an X Article (long-form post), the full article
// text is extracted. Otherwise the tweet text is returned.
func extractTweet(username, statusID string) (*URLResult, error) {
	endpoint := fmt.Sprintf(
		"https://api.fxtwitter.com/%s/status/%s", username, statusID)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch tweet: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf(
			"fxtwitter API returned status %d", resp.StatusCode)
	}

	var fxResp fxTweetResponse
	if err := json.NewDecoder(resp.Body).Decode(&fxResp); err != nil {
		return nil, fmt.Errorf("failed to parse tweet response: %w", err)
	}

	tweet := fxResp.Tweet

	// If the tweet has an X Article, extract its full text.
	if tweet.Article != nil && len(tweet.Article.Content.Blocks) > 0 {
		return extractXArticle(tweet.Article, tweet.Author.Name)
	}

	// If the tweet text contains an external link, try to extract
	// the article from that link.
	if link := findExternalLink(tweet.Text); link != "" {
		result, err := extractLinkedArticle(link)
		if err == nil && result.Text != "" {
			return result, nil
		}
	}

	// Fall back to the tweet text itself.
	title := fmt.Sprintf("Tweet by @%s", tweet.Author.ScreenName)
	text := tweet.Text
	if text == "" {
		text = "(empty tweet)"
	}

	return &URLResult{
		Title: title,
		Text:  strings.TrimSpace(text),
	}, nil
}

// extractXArticle builds a readable result from an X Article's blocks.
func extractXArticle(article *fxArticle, authorName string) (*URLResult, error) {
	var paragraphs []string
	for _, block := range article.Content.Blocks {
		text := strings.TrimSpace(block.Text)
		if text != "" {
			paragraphs = append(paragraphs, text)
		}
	}

	title := article.Title
	if title == "" {
		title = "X Article by " + authorName
	}

	return &URLResult{
		Title: title,
		Text:  strings.Join(paragraphs, "\n\n"),
	}, nil
}

// linkPattern matches URLs in plain text.
var linkPattern = regexp.MustCompile(`https?://[^\s"<>)]+`)

// twitterHosts are hosts that belong to Twitter/X.
var twitterHosts = map[string]bool{
	"twitter.com": true, "www.twitter.com": true,
	"x.com": true, "www.x.com": true,
	"t.co": true, "pic.twitter.com": true,
}

// findExternalLink finds the first non-Twitter URL in text.
func findExternalLink(text string) string {
	for _, link := range linkPattern.FindAllString(text, -1) {
		// Extract the host from the URL.
		parts := strings.SplitN(
			strings.TrimPrefix(
				strings.TrimPrefix(link, "https://"), "http://"),
			"/", 2)
		host := strings.ToLower(parts[0])
		if !twitterHosts[host] {
			return link
		}
	}
	return ""
}

// extractLinkedArticle follows a URL (including redirects) and
// extracts the readable article content using go-readability.
func extractLinkedArticle(rawURL string) (*URLResult, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(rawURL)
	if err != nil {
		return nil, fmt.Errorf("failed to follow link: %w", err)
	}
	resp.Body.Close()

	finalURL := resp.Request.URL.String()

	article, err := readability.FromURL(finalURL, 30*time.Second)
	if err != nil {
		return nil, fmt.Errorf("article extraction failed: %w", err)
	}

	return &URLResult{
		Title: article.Title,
		Text:  strings.TrimSpace(article.TextContent),
	}, nil
}
