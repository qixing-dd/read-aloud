package extractor

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"
)

// ErrBlockedHost is returned when a URL resolves to a blocked IP.
var ErrBlockedHost = fmt.Errorf("blocked: host resolves to a private or reserved IP")

// ValidateURL checks that a URL is safe to fetch. It rejects non-HTTP(S)
// schemes, hostnames that resolve to private/reserved IPs, and known
// cloud metadata endpoints.
func ValidateURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	scheme := strings.ToLower(u.Scheme)
	if scheme != "http" && scheme != "https" {
		return fmt.Errorf("unsupported scheme: %s", scheme)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("empty hostname")
	}

	if isBlockedHostname(host) {
		return ErrBlockedHost
	}

	ips, err := resolveHost(host)
	if err != nil {
		return fmt.Errorf("DNS resolution failed: %w", err)
	}

	for _, ip := range ips {
		if isPrivateIP(ip) {
			return ErrBlockedHost
		}
	}

	return nil
}

// blockedHostnames contains hostnames that should never be fetched.
var blockedHostnames = map[string]bool{
	"localhost":                true,
	"metadata.google.internal": true,
}

func isBlockedHostname(host string) bool {
	h := strings.ToLower(host)
	return blockedHostnames[h]
}

func resolveHost(host string) ([]net.IP, error) {
	if ip := net.ParseIP(host); ip != nil {
		return []net.IP{ip}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}

	ips := make([]net.IP, 0, len(addrs))
	for _, addr := range addrs {
		ips = append(ips, addr.IP)
	}
	return ips, nil
}

func isPrivateIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
		return true
	}

	// Block cloud metadata ranges: 169.254.169.254 and fd00:ec2::254.
	metadata4 := net.ParseIP("169.254.169.254")
	if ip.Equal(metadata4) {
		return true
	}

	return false
}
