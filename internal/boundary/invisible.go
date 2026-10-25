package boundary

import (
	"fmt"
	"strings"
)

// Characters a human cannot see but a model reads. Unicode Tag characters
// can spell out an entire hidden sentence (ASCII smuggling); bidi controls
// reorder or hide text; zero-width spaces split words so filters miss them.
//
// Stripped: Tags, bidi controls, zero-width space, word joiner, BOM.
// Counted but kept: zero-width joiner and non-joiner, which emoji sequences
// and Indic scripts need.

type Invisible struct {
	Text      string
	Stripped  int
	Tags      int // U+E0000..E007F
	Bidi      int // U+202A..202E, U+2066..2069
	ZeroWidth int // U+200B, U+2060, U+FEFF
	Joiners   int // U+200C, U+200D, kept
}

func isTag(r rune) bool  { return r >= 0xE0000 && r <= 0xE007F }
func isBidi(r rune) bool { return (r >= 0x202A && r <= 0x202E) || (r >= 0x2066 && r <= 0x2069) }
func isZero(r rune) bool { return r == 0x200B || r == 0x2060 || r == 0xFEFF }
func isJoin(r rune) bool { return r == 0x200C || r == 0x200D }

func ScanInvisible(text string) Invisible {
	var inv Invisible
	var b strings.Builder
	b.Grow(len(text))
	for _, r := range text {
		switch {
		case isTag(r):
			inv.Tags++
		case isBidi(r):
			inv.Bidi++
		case isZero(r):
			inv.ZeroWidth++
		default:
			if isJoin(r) {
				inv.Joiners++
			}
			b.WriteRune(r)
		}
	}
	inv.Text = b.String()
	inv.Stripped = inv.Tags + inv.Bidi + inv.ZeroWidth
	return inv
}

func HasTags(text string) bool {
	for _, r := range text {
		if isTag(r) {
			return true
		}
	}
	return false
}

func DescribeInvisible(inv Invisible) string {
	var parts []string
	if inv.Tags > 0 {
		parts = append(parts, fmt.Sprintf("%d Unicode Tag character(s), which encode hidden text", inv.Tags))
	}
	if inv.Bidi > 0 {
		parts = append(parts, fmt.Sprintf("%d bidi control(s)", inv.Bidi))
	}
	if inv.ZeroWidth > 0 {
		parts = append(parts, fmt.Sprintf("%d zero-width character(s)", inv.ZeroWidth))
	}
	if inv.Joiners > 0 {
		parts = append(parts, fmt.Sprintf("%d zero-width joiner(s) left in place", inv.Joiners))
	}
	return strings.Join(parts, ", ")
}
